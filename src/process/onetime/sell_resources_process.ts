import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { RoomResources } from "room_resource/room_resources"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { Market } from "shared/utility/market"
import { RoomName } from "shared/utility/room_name_types"
import { OwnedRoomProcess } from "process/owned_room_process"
import { MessageObserver } from "os/infrastructure/message_observer"
import { OperatingSystem } from "os/os"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { processLog } from "os/infrastructure/logger"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { Timestamp } from "shared/utility/timestamp"

ProcessDecoder.register("SellResourcesProcess", state => {
  return SellResourcesProcess.decode(state as SellResourcesProcessState)
})

export interface SellResourcesProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly resourceTypes: ResourceConstant[]
  readonly keepRunning: boolean
}

export class SellResourcesProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public readonly taskIdentifier: string
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private sleepUntil: Timestamp | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly resourceTypes: ResourceConstant[],
    private readonly keepRunning: boolean,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): SellResourcesProcessState {
    return {
      t: "SellResourcesProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      resourceTypes: this.resourceTypes,
      keepRunning: this.keepRunning,
    }
  }

  public static decode(state: SellResourcesProcessState): SellResourcesProcess {
    return new SellResourcesProcess(state.l, state.i, state.roomName, state.resourceTypes, state.keepRunning ?? false)
  }

  public static create(processId: ProcessId, roomName: RoomName, resourceTypes: ResourceConstant[], keepRunning: boolean): SellResourcesProcess {
    return new SellResourcesProcess(Game.time, processId, roomName, resourceTypes, keepRunning)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.roomName)} selling ${this.resourceTypes.map(resourceType => coloredResourceType(resourceType)).join(",")}`,
    ]

    if (this.sleepUntil != null) {
      descriptions.push(`sleeping ${this.sleepUntil - Game.time} ticks`)
    }

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "add", "remove"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "add": {
        const listArguments = new ListArguments(components)
        const resourceType = listArguments.resourceType(0, "resource type").parse()
        if (this.resourceTypes.includes(resourceType) === true) {
          throw `${coloredResourceType(resourceType)} already in the list`
        }
        this.resourceTypes.push(resourceType)
        if (OperatingSystem.os.isRunning(this.processId) !== true) {
          OperatingSystem.os.resumeProcess(this.processId)
          return `added ${coloredResourceType(resourceType)} and resumed`
        }

        return `added ${coloredResourceType(resourceType)}`
      }

      case "remove": {
        const listArguments = new ListArguments(components)
        const resourceType = listArguments.resourceType(0, "resource type").parse()
        const index = this.resourceTypes.indexOf(resourceType)

        if (index < 0) {
          throw `${coloredResourceType(resourceType)} is not in the list`
        }
        this.resourceTypes.splice(index, 1)

        return `removed ${coloredResourceType(resourceType)}`
      }

      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    if (this.sleepUntil != null) {
      if (this.sleepUntil > Game.time) {
        return
      }
      this.sleepUntil = null
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const terminal = roomResource.activeStructures.terminal
    if (terminal == null) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    if (this.resourceTypes.length <= 0) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    this.runWith(terminal, roomResource)
  }

  private runWith(terminal: StructureTerminal, roomResource: OwnedRoomResource): void {
    if (terminal.cooldown > 0) {
      return
    }
    if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 10000 || roomResource.getResourceAmount(RESOURCE_ENERGY) < 50000) {
      return
    }

    const storage = roomResource.activeStructures.storage

    for (const resourceType of this.resourceTypes) {
      const amountInTerminal = terminal.store.getUsedCapacity(resourceType)
      const amountInStorage = (storage?.store.getUsedCapacity(resourceType) ?? 0)

      if (amountInTerminal <= 0) {
        if (amountInStorage <= 0) {
          const resourceIndex = this.resourceTypes.indexOf(resourceType)
          if (resourceIndex >= 0 && this.keepRunning !== true) {
            processLog(this, `all ${coloredResourceType(resourceType)} sold from ${roomLink(this.roomName)}`)
            this.resourceTypes.splice(resourceIndex, 1)
          }
        }
        continue
      }

      if (amountInTerminal < 2000 && amountInStorage > 0) {
        continue  // Storageから移している最中等の資源はスキップ
      }

      const result = Market.sell(resourceType, this.roomName, amountInTerminal)
      switch (result.resultType) {
      case "succeeded":
        processLog(this, result.value)
        return
      case "failed":
        processLog(this, result.reason)
        break
      }
    }

    this.sleepUntil = Game.time + 200
  }
}
