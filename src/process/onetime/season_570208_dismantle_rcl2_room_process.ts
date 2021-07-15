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

const numberOfDismantlers = 1

// Game.io("launch Season570208DismantleRcl2RoomProcess room_name=W27S26 target_room_name=W25S22 waypoints=W26S26,W26S25,W24S25,W24S22")
export interface Season570208DismantleRcl2RoomProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** target structure id */
  ti: Id<AnyStructure> | null
}

export class Season570208DismantleRcl2RoomProcess implements Process, Procedural {
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

  public encode(): Season570208DismantleRcl2RoomProcessState {
    return {
      t: "Season570208DismantleRcl2RoomProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      ti: this.target?.id ?? null,
    }
  }

  public static decode(state: Season570208DismantleRcl2RoomProcessState): Season570208DismantleRcl2RoomProcess {
    const target = ((): AnyStructure | null => {
      if (state.ti == null) {
        return null
      }
      return Game.getObjectById(state.ti)
    })()
    return new Season570208DismantleRcl2RoomProcess(state.l, state.i, state.p, state.tr, state.w, target)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season570208DismantleRcl2RoomProcess {
    return new Season570208DismantleRcl2RoomProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public runOnTick(): void {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const insufficientCreepCount = numberOfDismantlers - creepCount
    if (insufficientCreepCount > 0) {
      this.sendScout()
    }
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.removeConstructionSiteTask(creep),
      () => true,
    )


    // if (insufficientCreepCount > 0) {
    //   const priority: CreepSpawnRequestPriority = insufficientCreepCount > 2 ? CreepSpawnRequestPriority.High : CreepSpawnRequestPriority.Low
    //   this.requestDismantler(priority, insufficientCreepCount)
    // }

    // World.resourcePools.assignTasks(
    //   this.parentRoomName,
    //   this.identifier,
    //   CreepPoolAssignPriority.Low,
    //   creep => this.newDismantlerTask(creep),
    //   () => true,
    // )
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

  private sendScout(): void {
    // const childTasks: CreepTask[] = [
    //   MoveToRoomTask.create("W25S25", []),
    //   MoveToTask.create(new RoomPosition(49, 18, "W25S25"), 0),
    //   MoveToRoomTask.create(this.targetRoomName, ["W24S22"]),
    // ]
    // const options: SequentialTaskOptions = {
    //   ignoreFailure: false,
    //   finishWhenSucceed: false,
    // }
    // const initialTask = SequentialTask.create(childTasks, options)

    const initialTask = MoveToRoomTask.create(this.targetRoomName, this.waypoints)

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Scout],
      body: [MOVE],
      initialTask,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
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
    const constructionSitePriority = (structureType: StructureConstant): number => {
      const priority: StructureConstant[] = [
        STRUCTURE_TOWER,
        STRUCTURE_SPAWN,
        STRUCTURE_STORAGE,
        STRUCTURE_TERMINAL,
        STRUCTURE_LAB,
        STRUCTURE_EXTENSION,
      ]
      const index = priority.indexOf(structureType)
      if (index < 0) {
        return 100
      }
      return index
    }

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
