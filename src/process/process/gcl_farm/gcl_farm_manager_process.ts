import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { GclFarmProcess } from "./gcl_farm_process"
import { OperatingSystem } from "os/os"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { GclFarmRoom } from "./gcl_farm_types"
import { validateGclFarmTarget } from "./gcl_farm_target_validator"
import { GclFarmRoomPlan } from "./gcl_farm_planner"
import { KeywordArguments } from "shared/utility/argument_parser/keyword_argument_parser"
import { GclFarmResources } from "room_resource/gcl_farm_resources"
import { describePosition } from "prototype/room_position"

ProcessDecoder.register("GclFarmManagerProcess", state => {
  return GclFarmManagerProcess.decode(state as GclFarmManagerProcessState)
})

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
      const farmRoomName = this.farmProcess.roomName
      const farmDescriptions: string[] = [
        `farming at ${roomLink(farmRoomName)}`
      ]
      const farmInfo = GclFarmResources.getFarmInfo(farmRoomName)
      if (farmInfo != null) {
        farmDescriptions.push(`deliver pos: ${describePosition(farmInfo.deliverDestinationPosition)}, deliver target ID: ${farmInfo.deliverTargetId}`)
      }
      descriptions.push(farmDescriptions.join(", "))
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
    const keywardArguments = new KeywordArguments(args)
    const targetRoomName = keywardArguments.roomName("room_name").parse()
    const parentRoomNames = keywardArguments.roomNameList("parent_room_names").parse()
    const planName = keywardArguments.string("plan_name").parse()
    const storagePosition = keywardArguments.localPosition("storage_position").parse()

    const targetRoom = Game.rooms[targetRoomName]
    if (targetRoom == null) {
      throw `target room ${roomLink(targetRoomName)} is not visible`
    }
    if (targetRoom.controller == null) {
      throw `target room ${roomLink(targetRoomName)} doesn't have a controller`
    }

    const roomPlan = GclFarmRoomPlan.createRoomPlan(targetRoom.controller, planName, storagePosition)
    roomPlan.showVisible()

    const target: GclFarmRoom = {
      roomName: targetRoomName,
      parentRoomNames,
      plan: roomPlan.positions,
    }

    const validationErrors = validateGclFarmTarget(target)
    if (validationErrors.errors.length > 0) {
      throw `Invalid target ${roomLink(targetRoomName)}\n${validationErrors.errors.join("\n")}`
    }

    this.targetRooms.push(target)
    GclFarmResources.addFarmRoom(targetRoomName)

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

    GclFarmResources.removeFarmRoom(targetRoomName)

    return `removed ${roomLink(targetRoomName)}, ${this.targetRooms.length} targets, index: ${this.targetRoomIndex}`
  }

  public runOnTick(): void {
    if (this.farmProcessId != null) {
      const farmProcess = OperatingSystem.os.processOf(this.farmProcessId) // constructor内で（=OSの起動中）行うとchild processの方が起動が遅いため常に失敗する
      if (farmProcess instanceof GclFarmProcess) {
        this.farmProcess = farmProcess
      } else {
        PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} invalid child process ${farmProcess}, ${farmProcess?.processId}, ${this.farmProcessId}`)
        this.farmProcessId = null
        this.farmProcess = null
      }
    }

    if (this.farmProcess == null) {
      this.launchFarm()
      return
    }
    if (this.shouldFinishCurrentFarm(this.farmProcess) === true) {
      // this.teardownFarm(this.farmProcess)
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
      PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} cannot retrieve target, ${this.targetRooms.length} targets, index: ${this.targetRoomIndex}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }
    const targetRoom = Game.rooms[target.roomName]
    if (targetRoom == null) {
      return
    }

    const validationErrors = validateGclFarmTarget(target)
    if (validationErrors.errors.length > 0) {
      PrimitiveLogger.fatal(`${this.constructor.name} ${this.processId} cannot launch GCL farm on ${roomLink(target.roomName)}\n${validationErrors.errors.join("\n")}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const process = OperatingSystem.os.addProcess(this.processId, processId => {
      return GclFarmProcess.create(processId, targetRoom, target.parentRoomNames, target.plan)
    })
    this.farmProcessId = process.processId
    this.farmProcess = process
  }
}
