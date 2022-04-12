import { Procedural } from "../../../src/process/procedural"
import { Process, ProcessId } from "../../../src/process/process"
import { isRoomName, RoomCoordinate, RoomName } from "../../../src/utility/room_name"
import { coloredResourceType, coloredText, roomLink } from "../../../src/utility/log"
import { ProcessState } from "../../../src/process/process_state"
import { CreepRole } from "../../../src/prototype/creep_role"
import { generateCodename } from "../../../src/utility/unique_id"
import { World } from "../../../src/world_info/world_info"
import { CreepSpawnRequestPriority } from "../../../src/world_info/resource_pool/creep_specs"
import { PrimitiveLogger } from "../../../src/os/infrastructure/primitive_logger"
import { processLog } from "../../../src/os/infrastructure/logger"
import { MessageObserver } from "../../../src/os/infrastructure/message_observer"
import { MoveToTargetTask } from "../../../src/v5_object_task/creep_task/combined_task/move_to_target_task"
import { BoostApiWrapper } from "../../../src/v5_object_task/creep_task/api_wrapper/boost_api_wrapper"
import { OperatingSystem } from "../../../src/os/os"
import { CreepName } from "../../../src/prototype/creep"
import { GameConstants } from "../../../src/utility/constants"
import { boostableCreepBody } from "../../../src/utility/resource"
import { RoomResources } from "../../../src/room_resource/room_resources"
import { BoostLabChargerProcess, BoostLabChargerProcessLabInfo } from "../../../src/process/process/boost_lab_charger_process"
import { directionName } from "../../../src/utility/direction"
import { ProcessDecoder } from "../../../src/process/process_decoder"
import { PlatoonState } from "../../../../submodules/private/attack/platoon/platoon"

ProcessDecoder.register("PlatoonProcess", state => {
  return PlatoonProcess.decode(state as PlatoonProcessState)
})

type ParentRoomInfo = {
  readonly parentRoomName: RoomName
  readonly waypoints: RoomName[]
}
type TargetRoomInfo = {
  readonly targetRoomName: RoomName
  readonly parentRoomInfo: ParentRoomInfo
}

export interface PlatoonProcessState extends ProcessState {
  readonly targetRoomInfo: TargetRoomInfo
  readonly platoonState: PlatoonState
}

export class PlatoonProcess implements Process, Procedural, MessageObserver {
  public get launchTime(): number {
    return this.state.l
  }
  public get processId(): ProcessId {
    return this.state.i
  }
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  public get targetRoomName(): RoomName {
    return this.target.roomName
  }

  private readonly codename: string
  private readonly quadSpec: QuadSpec

  private constructor(
    public readonly state: PlatoonProcessState,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    this.quadSpec = new QuadSpec(this.quadType)
  }

  public encode(): PlatoonProcessState {
    return {
      t: "PlatoonProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      target: this.target,
      quadType: this.quadType,
      creepNames: this.creepNames,
      quadState: this.quadState,
      manualOperations: this.manualOperations,
      nextTargets: this.nextTargets,
    }
  }

  public static decode(state: PlatoonProcessState): PlatoonProcess {
    return new PlatoonProcess(state.l, state.i, state.p, state.target, state.quadType, state.creepNames, state.quadState, state.manualOperations, state.nextTargets)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], predefinedTargetIds: Id<AttackTarget>[], quadType: QuadType): PlatoonProcess {
    const quadSpec = new QuadSpec(quadType)
    if (quadSpec.boosts.length > 0) {
      launchLabChargerProcess(parentRoomName, quadSpec)
    }
    const manualOperations: ManualOperations = {
      targetIds: predefinedTargetIds,
      direction: null,
    }
    const target: TargetInfo = {
      roomName: targetRoomName,
      waypoints,
      action: null,
      plan: null,
      message: null,
    }
    return new PlatoonProcess(Game.time, processId, parentRoomName, target, quadType, [], null, manualOperations, [])
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    return `${roomLink(this.parentRoomName)} => ${roomLink(this.targetRoomName)} ${creepCount}cr ${this.quadType}`
  }

  public didReceiveMessage(message: string): string {
    if (message === "clear") {
      this.manualOperations.targetIds.splice(0, this.manualOperations.targetIds.length)
      return "target cleared"
    }
    if (message === "status") {
      const descriptions: string[] = [
        `targets: ${roomLink(this.targetRoomName)},${this.nextTargets.map(n => roomLink(n.roomName)).join(",")}`,
        (this.quadState == null ? "no quad" : `direction: ${this.quadState.direction}`),
        (this.manualOperations.targetIds.length <= 0 ? "no targets" : `targets: ${this.manualOperations.targetIds.join(",")}`),
      ]
      if (this.target.plan != null) {
        descriptions.unshift(`plan: ${this.target.plan}`)
      }
      if (this.target.action != null) {
        descriptions.unshift(`action: ${this.target.action}`)
      }
      return descriptions.join(", ")
    }
    if (message === "flee") {
      this.target.action = "flee"
      return "action: flee"
    }
    if (message === "noflee") {
      this.target.action = "noflee"
      return "action: noflee"
    }
    if (message === "drain") {
      this.target.action = "drain"
      return "action: drain"
    }
    if (message === "clear action") {
      this.target.action = null
      this.target.message = null
      return "action cleared"
    }
    if (message === "planD") {
      this.target.plan = "destroy defence facility only"
      return "set 'destroy defence facility only'"
    }
    if (message === "planT") {
      this.target.plan = "leave terminal"
      return "set 'leave terminal'"
    }
    if (message === "clear plan") {
      this.target.plan = null
      return "plan cleared"
    }
    if (message.startsWith("say ")) {
      const squadMessage = message.slice(4)
      if (squadMessage.length > 0) {
        this.target.message = squadMessage
        return `set message "${squadMessage}"`
      }
      this.target.message = null
      return "clear message"
    }
    const direction = parseInt(message, 10)
    if (message.length <= 1 && isNaN(direction) !== true && ([TOP, BOTTOM, RIGHT, LEFT] as number[]).includes(direction) === true) {
      if (this.quadState == null) {
        if (this.creepNames.length > 0) {
          return "quad died"
        } else {
          this.manualOperations.direction = direction as TOP | BOTTOM | RIGHT | LEFT
          return `direction ${coloredText(directionName(direction as TOP | BOTTOM | RIGHT | LEFT), "info")} set`
        }
      }
      this.quadState.nextDirection = direction as TOP | BOTTOM | RIGHT | LEFT
      return `direction ${coloredText(directionName(direction as TOP | BOTTOM | RIGHT | LEFT), "info")} set`
    }
    const parseTargetRoomInfo = (rawInfo: string): TargetInfo | string => {
      const roomNames = rawInfo.split(",")
      if (rawInfo.length <= 0 || roomNames.length <= 0) {
        return "no target room specified"
      }
      if (roomNames.some(roomName => !isRoomName(roomName)) === true) {
        return `invalid room name ${roomNames}`
      }
      const targetRoomName = roomNames.pop()
      if (targetRoomName == null) {
        return "can't retrieve target room"
      }
      return {
        roomName: targetRoomName,
        waypoints: roomNames,
        action: null,
        plan: null,
        message: null,
      }
    }
    const changeTargetCommand = "change target "
    if (message.startsWith(changeTargetCommand)) {
      const rawRooms = message.slice(changeTargetCommand.length)
      const roomInfo = parseTargetRoomInfo(rawRooms)
      if (typeof roomInfo === "string") {
        return roomInfo
      }
      this.target = roomInfo
      const nextTargetsInfo = this.nextTargets.length > 0 ? `, ${this.nextTargets.length} following targets cleared` : ""
      this.nextTargets.splice(0, this.nextTargets.length)
      return `target room: ${roomInfo.roomName}, waypoints: ${roomInfo.waypoints} set${nextTargetsInfo}`
    }
    const addTargetCommand = "add target "
    if (message.startsWith(addTargetCommand)) {
      const rawRooms = message.slice(addTargetCommand.length)
      const roomInfo = parseTargetRoomInfo(rawRooms)
      if (typeof roomInfo === "string") {
        return roomInfo
      }
      this.nextTargets.push(roomInfo)
      return `target room: ${roomInfo.roomName}, waypoints: ${roomInfo.waypoints} added`
    }
    if (message.length <= 0) {
      return "Empty message"
    }
    this.manualOperations.targetIds.unshift(message as Id<AnyStructure | AnyCreep>)
    return `target ${message} set`
  }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      return
    }
  }
}
