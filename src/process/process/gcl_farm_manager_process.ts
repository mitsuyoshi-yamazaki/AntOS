import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, profileLink, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { GclFarmProcess } from "./gcl_farm_process"
import { OperatingSystem } from "os/os"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { Invader } from "game/invader"
import { GameConstants } from "utility/constants"
import { Timestamp } from "utility/timestamp"

ProcessDecoder.register("GclFarmManagerProcess", state => {
  return GclFarmManagerProcess.decode(state as GclFarmManagerProcessState)
})

type GclFarmRoom = {
  readonly roomName: RoomName
  readonly parentRoomNames: RoomName[]
}

interface GclFarmManagerProcessState extends ProcessState {
  readonly name: string
  readonly targetRooms: GclFarmRoom[]
  readonly targetRoomIndex: number
  readonly farmProcessId: ProcessId | null
}

export class GclFarmManagerProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private farmProcess: GclFarmProcess | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly name: string,
    public readonly targetRooms: GclFarmRoom[],
    private targetRoomIndex: number,
    private farmProcessId: ProcessId | null
  ) {
    this.identifier = `${this.constructor.name}_${this.name}`

    if (farmProcessId != null) {
      const farmProcess = OperatingSystem.os.processOf(farmProcessId)
      if (farmProcess instanceof GclFarmProcess) {
        this.farmProcess = farmProcess
      } else {
        this.farmProcessId = null
      }
    }
  }

  public encode(): GclFarmManagerProcessState {
    return {
      t: "GclFarmManagerProcess",
      l: this.launchTime,
      i: this.processId,
      name: this.name,
      targetRooms: this.targetRooms,
      targetRoomIndex: this.targetRoomIndex,
      farmProcessId: this.farmProcessId,
    }
  }

  public static decode(state: GclFarmManagerProcessState): GclFarmManagerProcess {
    return new GclFarmManagerProcess(state.l, state.i, state.name, state.targetRooms, state.targetRoomIndex, state.farmProcessId)
  }

  public static create(processId: ProcessId, name: string): GclFarmManagerProcess {
    return new GclFarmManagerProcess(Game.time, processId, name, [], 0, null)
  }

  public processDescription(): string {
    const descriptions: string[] = [
      this.name
    ]

    if (this.farmProcess != null) {
      descriptions.push(`farming at ${roomLink(this.farmProcess.roomName)}`)
    } else {
      descriptions.push("no farm")
    }

    descriptions.push(...this.targetRooms.map(target => `- ${roomLink(target.roomName)}, parents: ${target.parentRoomNames.map(p => roomLink(p)).join(",")}`))

    return descriptions.join("\n")
  }

  public processShortDescription(): string {
    const roomDescription = (roomNames: RoomName[]): string => {
      return roomNames.map(roomName => roomLink(roomName)).join(",")
    }
    return `${this.name} ${roomDescription(this.targetRooms.map(target => target.roomName))}`
  }

  public didReceiveMessage(message: string): string {
    try {
      const commands = ["help", "add", "remove", "status"]
      const components = message.split(" ")
      const command = components.shift()

      switch (command) {
      case "help":
        return `commands: ${commands}
- add &lttarget room name&gt &ltparent room names&gt
- remove &lttarget room name&gt
- status
- help
          `

      case "add":
        return this.addTarget(components)

      case "remove":
        return this.removeTarget(components)

      case "status":
        return this.processDescription()

      default:
        throw `Invalid command ${command}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  /** throws */
  private addTarget(args: string[]): string {
    const listArguments = new ListArguments(args)
    const targetRoomName = listArguments.roomName(0, "target room name").parse()
    const parentRoomNames = listArguments.roomNameList(1, "parent room names").parse()

    const target: GclFarmRoom = {
      roomName: targetRoomName,
      parentRoomNames,
    }

    const validationErrors = this.validateTarget(target)
    if (validationErrors.errors.length > 0) {
      throw `Invalid target ${roomLink(targetRoomName)}\n${validationErrors.errors.join("\n")}`
    }

    this.targetRooms.push(target)

    return `Added ${roomLink(targetRoomName)}, parents: ${parentRoomNames.map(roomName => roomLink(roomName)).join(",")}`
  }

  /** throws */
  private removeTarget(args: string[]): string {
    const listArguments = new ListArguments(args)
    const targetRoomName = listArguments.roomName(0, "target room name").parse()

    const index = this.targetRooms.findIndex(target => target.roomName === targetRoomName)
    if (index < 0) {
      throw `${roomLink(targetRoomName)} is not in the list`
    }

    const currentTarget = this.targetRooms[this.targetRoomIndex]
    if (currentTarget == null) {
      throw `cannot find current target ${this.targetRooms.length} targets, index: ${this.targetRoomIndex}`
    }

    if (this.farmProcess != null && this.farmProcess.roomName === currentTarget.roomName) {
      throw `cannot remove ongoing farm ${roomLink(currentTarget.roomName)}`
    }

    this.targetRooms.splice(index, 1)
    if (this.targetRooms.length <= 0) {
      this.targetRoomIndex = 0
    }
    if (this.targetRoomIndex > index) {
      this.targetRoomIndex -= 1
    }

    return `removed ${roomLink(targetRoomName)}, ${this.targetRooms.length} targets, index: ${this.targetRoomIndex}`
  }

  public runOnTick(): void {
    if (this.farmProcess == null) {
      this.launchFarm()
      return
    }
    if (this.shouldFinishCurrentFarm(this.farmProcess) === true) {
      this.teardownFarm(this.farmProcess)
      return
    }
  }

  private shouldFinishCurrentFarm(farmProcess: GclFarmProcess): boolean {
    const roomResource = RoomResources.getOwnedRoomResource(farmProcess.roomName)
    if (roomResource == null) {
      return true
    }
    return roomResource.controller.level >= 8
  }

  private teardownFarm(farmProcess: GclFarmProcess): void {
    // TODO:

    if (this.targetRooms.length <= 0) {
      if ((Game.time % 29) === 11) {
        PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} no target rooms`)
      }
      return
    }
    this.targetRoomIndex = (this.targetRoomIndex + 1) % this.targetRooms.length
  }

  private launchFarm(): void {
    if (this.targetRooms.length <= 0) {
      return
    }

    const target = this.targetRooms[this.targetRoomIndex]
    if (target == null) {
      if ((Game.time % 37) === 11) {
        PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} cannot retrieve target, ${this.targetRooms.length} targets, index: ${this.targetRoomIndex}`)
      }
      return
    }

    const validationErrors = this.validateTarget(target)
    if (validationErrors.errors.length > 0) {
      PrimitiveLogger.fatal(`${this.constructor.name} ${this.processId} cannot launch GCL farm on ${roomLink(target.roomName)}\n${validationErrors.errors.join("\n")}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    // const process = OperatingSystem.os.addProcess(this.processId, processId => {
    //   return GclFarmProcess.create(processId, target.roomName, target.parentRoomNames)
    // })

  }

  /**
   * - 条件：
   *   - targetはInvader以外にclaimされていない
   *   - targetはInvaderか自分以外にreserveされていない
   *   - parent roomsはtargetの隣（通路が空いている）
   *   - parent roomsはRCL8以上
   *   - parent roomsは完全（Spawn, Storage, Terminal等の存在
   */
  private validateTarget(target: GclFarmRoom): { errors: string[] } {
    const errors: string[] = []
    const targetRoomInfo = RoomResources.getRoomInfo(target.roomName)

    if (targetRoomInfo == null) {
      return {
        errors: [`target ${roomLink(target.roomName)} is not observed`]
      }
    }

    const getRelativeTime = (timestamp: Timestamp): string => {
      if (timestamp < 1000) {
        return `${Game.time - timestamp} ticks ago`
      }
      return `${Math.floor((Game.time - timestamp) / 1000)}k ticks ago`
    }

    switch (targetRoomInfo.roomType) {
    case "owned":
      errors.push(`target ${roomLink(target.roomName)} is already mine`)
      break
    case "normal":
      if (targetRoomInfo.owner != null) {
        switch (targetRoomInfo.owner.ownerType) {
        case "claim":
          if (targetRoomInfo.owner.username !== Invader.username) {
            errors.push(`target ${roomLink(target.roomName)} is owned by ${profileLink(targetRoomInfo.owner.username)} ${getRelativeTime(targetRoomInfo.observedAt)}`)
          }
          break
        case "reserve":
          if ([Invader.username, Game.user.name].includes(targetRoomInfo.owner.username) !== true) {
            errors.push(`target ${roomLink(target.roomName)} is reserved by ${profileLink(targetRoomInfo.owner.username)} ${getRelativeTime(targetRoomInfo.observedAt)}`)
          }
          break
        }
      }
      break
    }

    const neighbourRoomNames = [...targetRoomInfo.neighbourRoomNames]

    target.parentRoomNames.forEach(parentRoomName => {
      if (neighbourRoomNames.includes(parentRoomName) !== true) {
        errors.push(`parent room ${roomLink(parentRoomName)} is not next to the target ${roomLink(target.roomName)}`)
        return
      }

      const parentRoomResource = RoomResources.getOwnedRoomResource(parentRoomName)
      if (parentRoomResource == null) {
        errors.push(`parent room ${roomLink(parentRoomName)} is not owned`)
        return
      }
      if (parentRoomResource.controller.level < 8) {
        errors.push(`parent room ${roomLink(parentRoomName)} is under development (RCL${parentRoomResource.controller.level})`)
        return
      }
      if (
        parentRoomResource.activeStructures.terminal == null
        || parentRoomResource.activeStructures.storage == null
        || parentRoomResource.activeStructures.spawns.length < GameConstants.structure.maxCount.spawn
      ) {
        errors.push(`parent room ${roomLink(parentRoomName)} lack of vital structures`)
        return
      }
    })

    return {
      errors,
    }
  }
}
