import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "os/infrastructure/logger"
import { OperatingSystem } from "os/os"
import { DistributorProcess } from "../process/distributor_process"
import { RoomResources } from "room_resource/room_resources"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import type { SectorName } from "shared/utility/room_sector_type"
import { OwnedRoomProcess } from "process/owned_room_process"

ProcessDecoder.register("Season2055924SendResourcesProcess", state => {
  return Season2055924SendResourcesProcess.decode(state as Season2055924SendResourcesProcessState)
})

export interface Season2055924SendResourcesProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  readonly targetSectorNames: SectorName[] | null
  readonly excludes: ResourceConstant[]
}

export class Season2055924SendResourcesProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.parentRoomName
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly targetSectorNames: SectorName[] | null,
    private excludes: ResourceConstant[],
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season2055924SendResourcesProcessState {
    return {
      t: "Season2055924SendResourcesProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetSectorNames: this.targetSectorNames,
      excludes: this.excludes,
    }
  }

  public static decode(state: Season2055924SendResourcesProcessState): Season2055924SendResourcesProcess {
    return new Season2055924SendResourcesProcess(state.l, state.i, state.p, state.targetSectorNames, state.excludes)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetSectorNames: SectorName[] | null, excludedResourceTypes: ResourceConstant[]): Season2055924SendResourcesProcess {
    const distributorProcess = OperatingSystem.os.listAllProcesses()
      .map(processInfo => processInfo.process)
      .find(process => {
        if (!(process instanceof DistributorProcess)) {
          return false
        }
        return process.parentRoomName === parentRoomName
      }) as DistributorProcess | null
    if (distributorProcess != null) {
      distributorProcess.setDrainStorage()
      PrimitiveLogger.log(`Drain storage ${roomLink(parentRoomName)}`)
    } else {
      PrimitiveLogger.fatal(`No distributor process found for ${roomLink(parentRoomName)}`)
    }
    return new Season2055924SendResourcesProcess(Game.time, processId, parentRoomName, targetSectorNames, excludedResourceTypes)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.parentRoomName),
    ]
    if (this.excludes.length > 0) {
      descriptions.push(`excludes: ${this.excludes.map(resourceType => coloredResourceType(resourceType)).join(",")}`)
    }
    if (this.targetSectorNames != null) {
      descriptions.push(`target sectors: ${this.targetSectorNames.join(",")}`)
    }
    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "exclude", "clear_excluded_resource"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "exclude": {
        const listArguments = new ListArguments(components)
        const resourceType = listArguments.resourceType(0, "resource type").parse()
        this.excludes.push(resourceType)
        return `excluded resources: ${this.excludes.map(resource => coloredResourceType(resource)).join(",")}`
      }

      case "clear_excluded_resource": {
        const oldValues = [...this.excludes]
        this.excludes = []
        return `cleared excluded resources: ${oldValues.map(resource => coloredResourceType(resource)).join(",")}`
      }

      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    const terminal = objects.activeStructures.terminal
    if (terminal == null) {
      processLog(this, `No terminal in ${roomLink(this.parentRoomName)} suspending...`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    if (terminal.cooldown > 0) {
      return
    }
    if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 1000) {
      processLog(this, `No energy in terminal ${roomLink(this.parentRoomName)}`)
      return
    }

    const sendResourceType = this.sendResourceType(terminal, objects.activeStructures.storage)
    if (sendResourceType == null) {
      return
    }
    this.sendResource(sendResourceType, terminal)
  }

  private sendResource(resourceType: ResourceConstant, terminal: StructureTerminal): void {
    const resourceAmount = ((): number => {
      const maximumTransferCost = Math.floor(terminal.store.getUsedCapacity(RESOURCE_ENERGY) / 2)
      if (resourceType !== RESOURCE_ENERGY) {
        return Math.min(terminal.store.getUsedCapacity(resourceType), maximumTransferCost)
      }
      return maximumTransferCost
    })()
    if (resourceAmount <= 0) {
      PrimitiveLogger.programError(`${this.identifier} no ${coloredResourceType(resourceType)} in ${terminal} ${roomLink(this.parentRoomName)}`)
      return
    }
    const destinationRoomName = this.findDestinationFor(resourceType, resourceAmount)
    if (destinationRoomName == null) {
      processLog(this, `${coloredText("[Warning]", "warn")} No room to send ${coloredResourceType(resourceType)} from ${roomLink(this.parentRoomName)}`)
      return
    }
    const result = terminal.send(resourceType, resourceAmount, destinationRoomName)
    switch (result) {
    case OK:
      processLog(this, `${coloredText("[Info]", "info")} ${resourceAmount} ${coloredResourceType(resourceType)} sent from ${roomLink(this.parentRoomName)} to ${roomLink(destinationRoomName)}`)
      break

    case ERR_NOT_ENOUGH_RESOURCES:
      break

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
    case ERR_TIRED:
      PrimitiveLogger.programError(`${this.identifier} terminal.send() returns ${result} ${roomLink(this.parentRoomName)}`)
      break
    }
  }

  private sendResourceType(terminal: StructureTerminal, storage: StructureStorage | null): ResourceConstant | null {
    const resourceTypes = (Object.keys(terminal.store) as ResourceConstant[])
      .filter(resourceType => this.excludes.includes(resourceType) !== true)
    if (storage == null || terminal.store.getFreeCapacity() < 10000) {
      return resourceTypes.sort((lhs, rhs) => {
        if (lhs === RESOURCE_ENERGY) {
          return 1
        }
        if (rhs === RESOURCE_ENERGY) {
          return -1
        }
        return terminal.store.getUsedCapacity(rhs) - terminal.store.getUsedCapacity(lhs)
      })[0] ?? null
    }

    const resourceType = resourceTypes.sort((lhs, rhs) => {
      if (lhs === RESOURCE_ENERGY) {
        return 1
      }
      if (rhs === RESOURCE_ENERGY) {
        return -1
      }
      const storageAmountL = storage.store.getUsedCapacity(lhs)
      const storageAmountR = storage.store.getUsedCapacity(rhs)
      if (storageAmountL !== storageAmountR) {
        return storageAmountL - storageAmountR
      }
      return terminal.store.getUsedCapacity(rhs) - terminal.store.getUsedCapacity(lhs)
    })[0] ?? null

    if (resourceType == null) {
      return null
    }
    const terminalResourceLimitAmount = 20000
    if (storage.store.getUsedCapacity(resourceType) > 0 && terminal.store.getUsedCapacity(resourceType) < terminalResourceLimitAmount) {
      return null
    }
    return resourceType
  }

  private findDestinationFor(resourceType: ResourceConstant, amount: number): RoomName | null {
    const targetTerminals = [...RoomResources.getOwnedRoomResources()]
      .flatMap(roomResource => {
        if (this.targetSectorNames != null) {
          if (this.targetSectorNames.includes(roomResource.room.coordinate.sectorName()) !== true) {
            return []
          }
        }
        if (roomResource.room.name === this.parentRoomName) {
          return []
        }
        const targetTerminal = roomResource.activeStructures.terminal
        if (targetTerminal == null) {
          return []
        }
        if ((targetTerminal.store.getFreeCapacity() - amount) < 20000) {
          return []
        }
        return targetTerminal
      })
      .sort((lhs, rhs) => {
        return Game.map.getRoomLinearDistance(lhs.room.name, this.parentRoomName) - Game.map.getRoomLinearDistance(rhs.room.name, this.parentRoomName)
      })

    for (const targetTerminal of targetTerminals) {
      if (targetTerminal.store.getUsedCapacity(resourceType) > 0) {
        return targetTerminal.room.name
      }
    }

    return targetTerminals[0]?.room.name ?? null
  }
}
