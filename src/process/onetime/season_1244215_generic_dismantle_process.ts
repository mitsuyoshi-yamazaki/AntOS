import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepName } from "prototype/creep"
import { processLog } from "process/process_log"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { DismantleApiWrapper } from "v5_object_task/creep_task/api_wrapper/dismantle_api_wrapper"

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

// Game.io("launch -l Season1244215GenericDismantleProcess room_name=W3S24 target_room_name=W2S24 waypoints=W3S25,W2S25 target_id=")
// Game.io("launch -l Season1244215GenericDismantleProcess room_name=W9S24 target_room_name=W11S23 waypoints=W10S24,W10S22 target_id=60fc5b672d39b65e8b50d195")

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
      const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
      if (creeps[0] != null) {
        this.creepName = creeps[0].name
      } else {
        this.requestDismantler()
        return
      }
    }
    const creep = Game.creeps[this.creepName]
    if (creep == null) {
      processLog(this, `Creep dead (target: ${this.targetRoomName})`)
      return
    }

    this.runCreep(creep)
  }

  private runCreep(creep: Creep): void {
    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    const constructionSite = this.constructionSite(creep)
    if (constructionSite != null) {
      creep.v5task = MoveToTask.create(constructionSite.pos, 0)
      return
    }

    const target = this.getTarget(creep)
    if (target == null) {
      return
    }
    creep.v5task = MoveToTargetTask.create(DismantleApiWrapper.create(target))
  }

  private constructionSite(creep: Creep): ConstructionSite | null {
    const constructionSites = creep.room.find(FIND_HOSTILE_CONSTRUCTION_SITES).filter(site => {
      if (site.progress <= 0) {
        return false
      }
      if (site.pos.v5TargetedBy.length > 0) {
        return false
      }
      return true
    })
    return creep.pos.findClosestByRange(constructionSites) ?? null
  }

  private getTarget(creep: Creep): AnyStructure | null {
    const target = Game.getObjectById(this.targetId)
    if (target != null) {
      return target
    }
    processLog(this, `Target destroyed (target: ${this.targetRoomName})`)

    const excluded: StructureConstant[] = [STRUCTURE_CONTROLLER]
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES).filter(structure => (excluded.includes(structure.structureType) !== true))
    return creep.pos.findClosestByRange(hostileStructures) ?? null
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
