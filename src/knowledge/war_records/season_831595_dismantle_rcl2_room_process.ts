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
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { DismantleApiWrapper } from "v5_object_task/creep_task/api_wrapper/dismantle_api_wrapper"

const numberOfCreeps = 2

export interface Season831595DismantleRcl2RoomProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** target structure id */
  ti: Id<AnyStructure> | null
}

// Game.io("launch -l Season831595DismantleRcl2RoomProcess room_name=W3S24 target_room_name=W2S24 waypoints=W3S23,W2S23")
// Game.io("launch -l Season831595DismantleRcl2RoomProcess room_name=W3S24 target_room_name=W2S24 waypoints=W3S25,W2S25")
export class Season831595DismantleRcl2RoomProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private readonly dismantlerRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]
  private readonly dismantlerBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private target: AnyStructure | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season831595DismantleRcl2RoomProcessState {
    return {
      t: "Season831595DismantleRcl2RoomProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      ti: this.target?.id ?? null,
    }
  }

  public static decode(state: Season831595DismantleRcl2RoomProcessState): Season831595DismantleRcl2RoomProcess {
    const target = ((): AnyStructure | null => {
      if (state.ti == null) {
        return null
      }
      return Game.getObjectById(state.ti)
    })()
    return new Season831595DismantleRcl2RoomProcess(state.l, state.i, state.p, state.tr, state.w, target)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season831595DismantleRcl2RoomProcess {
    return new Season831595DismantleRcl2RoomProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const insufficientCreepCount = numberOfCreeps - creepCount

    if (insufficientCreepCount > 0) {
      const priority: CreepSpawnRequestPriority = insufficientCreepCount > 2 ? CreepSpawnRequestPriority.Medium : CreepSpawnRequestPriority.Low
      this.requestDismantler(priority, insufficientCreepCount)
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newDismantlerTask(creep),
      () => true,
    )
  }

  private requestDismantler(priority: CreepSpawnRequestPriority, numberOfCreeps: number): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps,
      codename: this.codename,
      roles: this.dismantlerRoles,
      body: this.dismantlerBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private newDismantlerTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    const attackerTarget = ((): AnyStructure | null => {
      if (this.target != null) {
        return this.target
      }
      return this.structureTarget(creep)
    })()

    if (attackerTarget == null) {
      const removeConstructionSiteTask = this.removeConstructionSiteTask(creep)
      if (removeConstructionSiteTask != null) {
        return removeConstructionSiteTask
      }
      if (creep.room.controller != null) {
        return MoveToTask.create(creep.room.controller.pos, 2)
      }
      return null
    }

    return MoveToTargetTask.create(DismantleApiWrapper.create(attackerTarget))
  }

  private structureTarget(creep: Creep): AnyStructure | null {
    const structures = creep.room.find(FIND_HOSTILE_STRUCTURES)
    const spawn = structures.find(structure => structure instanceof StructureSpawn)
    if (spawn != null) {
      return spawn
    }
    const extension = structures.find(structure => structure instanceof StructureExtension)
    if (extension != null) {
      return extension
    }
    const road = creep.pos.findClosestByRange(structures.filter(structure => structure instanceof StructureRoad))
    return road ?? null
  }

  private removeConstructionSiteTask(creep: Creep): CreepTask | null {
    const targetSite = this.targetConstructionSite(creep)
    if (targetSite == null) {
      return null
    }
    if (targetSite.pos.isEqualTo(creep.pos) === true) {
      const i = (Game.time % 3) - 1
      const j = ((Game.time + 1) % 3) - 1
      const position = new RoomPosition(targetSite.pos.x + i, targetSite.pos.y + j, creep.room.name)
      return MoveToTask.create(position, 0)
    }
    return MoveToTask.create(targetSite.pos, 0)
  }

  private targetConstructionSite(creep: Creep): ConstructionSite<BuildableStructureConstant> | null {
    // const constructionSitePriority = (structureType: StructureConstant): number => {
    //   const priority: StructureConstant[] = [
    //     STRUCTURE_TOWER,
    //     STRUCTURE_SPAWN,
    //     STRUCTURE_STORAGE,
    //     STRUCTURE_TERMINAL,
    //     STRUCTURE_LAB,
    //     STRUCTURE_EXTENSION,
    //   ]
    //   const index = priority.indexOf(structureType)
    //   if (index < 0) {
    //     return 100
    //   }
    //   return index
    // }

    const constructionSites = creep.room.find(FIND_HOSTILE_CONSTRUCTION_SITES) //.sort((lhs, rhs))


    const spawnSite = constructionSites.find(site => site.structureType === STRUCTURE_SPAWN)
    if (spawnSite != null) {
      return spawnSite
    }
    const targetSite = creep.pos.findClosestByRange(constructionSites)
    if (targetSite != null) {
      return targetSite
    }
    return null
  }
}
