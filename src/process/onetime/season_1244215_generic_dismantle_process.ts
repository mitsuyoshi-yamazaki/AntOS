import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { BoostApiWrapper } from "v5_object_task/creep_task/api_wrapper/boost_api_wrapper"
import { CreepName } from "prototype/creep"
import { processLog } from "process/process_log"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { moveToRoom } from "script/move_to_room"
import { GameConstants } from "utility/constants"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"

const dismantlerRole: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]
const dismantlerBody: BodyPartConstant[] = [
  WORK, WORK, WORK, WORK, WORK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  WORK, WORK, WORK, WORK, WORK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  WORK, WORK, WORK, WORK, WORK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  WORK, WORK, WORK, WORK, WORK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  WORK, WORK, WORK, WORK, WORK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
]

export interface Season1244215GenericDismantleProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  targetId: Id<AnyStructure>
  creepName: CreepName | null
}

// Game.io("launch -l Season1244215GenericDismantleProcess room_name=W14S28 target_room_name=W9S29 waypoints=W14S30,W10S30,W10S29 tower_count=3")
export class Season1244215GenericDismantleProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private creepName: CreepName | null,
    private readonly targetId: Id<AnyStructure>,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1244215GenericDismantleProcessState {
    return {
      t: "Season1244215GenericDismantleProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      creepName: this.creepName,
      targetId: this.targetId,
    }
  }

  public static decode(state: Season1244215GenericDismantleProcessState): Season1244215GenericDismantleProcess {
    return new Season1244215GenericDismantleProcess(state.l, state.i, state.p, state.tr, state.w, state.creepName, state.targetId)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], targetId: Id<AnyStructure>): Season1244215GenericDismantleProcess {
    return new Season1244215GenericDismantleProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, targetId)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    if (this.creepName == null) {
      this.requestDismantler()
      return
    }
    const creep = Game.creeps[this.creepName]
    if (creep == null) {
      processLog(this, `Creep dead (target: ${this.targetRoomName})`)
      return
    }

    if (creep.v5task != null) {
      return
    }

    const target = Game.getObjectById(this.targetId)
    if (target == null) {
      processLog(this, `Target destroyed (target: ${this.targetRoomName})`)
      return
    }
    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target)
    }
  }

  private requestDismantler(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: dismantlerRole,
      body: dismantlerBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }
}
