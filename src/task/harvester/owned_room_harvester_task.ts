import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { ProblemFinder } from "problem/problem_finder"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { MoveToTask } from "object_task/creep_task/meta_task/move_to_task"
import { RunApiTask } from "object_task/creep_task/combined_task/run_api_task"
import { HarvestEnergyApiWrapper } from "object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { DropResourceApiWrapper } from "object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { OwnedRoomEnergySourceTask } from "task/hauler/owned_room_energy_source_task"
import { EnergySource } from "prototype/room_object"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"

export interface OwnedRoomHarvesterTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** source id */
  i: Id<Source>

  /** container */
  co: {
    /** construction site id */
    c: Id<ConstructionSite<STRUCTURE_CONTAINER>> | null

    /** id */
    i: Id<StructureContainer> | null
  }
}

// TODO: repair container
export class OwnedRoomHarvesterTask extends OwnedRoomEnergySourceTask {
  public readonly taskIdentifier: TaskIdentifier
  public get energySources(): EnergySource[] {
    if (this.containerId == null) {
      return []
    }
    const container = Game.getObjectById(this.containerId)
    return container != null ? [container] : []
  }

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly sourceId: Id<Source>,
    private containerConstructionSiteId: Id<ConstructionSite<STRUCTURE_CONTAINER>> | null,
    private containerId: Id<StructureContainer> | null,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.sourceId}`
  }

  public encode(): OwnedRoomHarvesterTaskState {
    return {
      t: "OwnedRoomHarvesterTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      i: this.sourceId,
      co: {
        c: this.containerConstructionSiteId ?? null,
        i: this.containerId ?? null,
      },
    }
  }

  public static decode(state: OwnedRoomHarvesterTaskState): OwnedRoomHarvesterTask | null {
    const children = decodeTasksFrom(state.c)
    return new OwnedRoomHarvesterTask(state.s, children, state.r, state.i, state.co.c, state.co.i)
  }

  public static create(roomName: RoomName, source: Source): OwnedRoomHarvesterTask {
    return new OwnedRoomHarvesterTask(Game.time, [], roomName, source.id, null, null)
  }

  public description(): string {
    return this.taskIdentifier
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const source = Game.getObjectById(this.sourceId)
    if (source == null) {
      PrimitiveLogger.fatal(`${this.description()} source ${this.sourceId} not found`)
      return TaskStatus.Failed
    }

    const [container, containerConstructionSite] = this.getObjects()
    this.checkContainer(objects, source, container, containerConstructionSite)

    const problemFinders: ProblemFinder[] = []
    problemFinders.push(...this.runHarvester(objects, source, container, containerConstructionSite))

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private getObjects(): [StructureContainer | null, ConstructionSite<STRUCTURE_CONTAINER> | null] {
    const container = ((): StructureContainer | null => {
      if (this.containerId == null) {
        return null
      }
      return Game.getObjectById(this.containerId)
    })()
    const containerConstructionSite = ((): ConstructionSite<STRUCTURE_CONTAINER> | null => {
      if (this.containerConstructionSiteId == null) {
        return null
      }
      return Game.getObjectById(this.containerConstructionSiteId)
    })()

    return [container, containerConstructionSite]
  }

  private checkContainer(
    objects: OwnedRoomObjects,
    source: Source,
    container: StructureContainer | null,
    containerConstructionSite: ConstructionSite<STRUCTURE_CONTAINER> | null
  ): void {
    if (container != null) {
      this.containerConstructionSiteId = null
      return
    }
    if (containerConstructionSite != null) {
      this.containerId = null
      return
    }
    this.containerId = null
    this.containerConstructionSiteId = null
    this.createConstructionSite(objects, source)
  }

  private createConstructionSite(objects: OwnedRoomObjects, source: Source): void {
    const constructionSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).find(site => site.structureType === STRUCTURE_CONTAINER)
    if (constructionSite != null) {
      this.containerConstructionSiteId = (constructionSite as ConstructionSite<STRUCTURE_CONTAINER>).id
      return
    }

    const spawn = objects.activeStructures.spawns[0]
    if (spawn == null) {
      PrimitiveLogger.fatal(`No spawns ${this.taskIdentifier}`)
      return
    }
    const resultPath = PathFinder.search(spawn.pos, { pos: source.pos, range: 1 })
    if (resultPath.incomplete === true) {
      PrimitiveLogger.fatal(`Source route calculation failed ${this.taskIdentifier}, incomplete path: ${resultPath.path}`)
      return  // TODO: 毎tick行わないようにする
    }

    const path = resultPath.path
    if (path.length <= 0) {
      PrimitiveLogger.fatal(`Source route calculation failed ${this.taskIdentifier}, no path`)
      return  // TODO: 毎tick行わないようにする
    }
    const position = path[path.length - 1]
    const result = source.room.createConstructionSite(position.x, position.y, STRUCTURE_CONTAINER)
    switch (result) {
    case OK:
      return

    case ERR_INVALID_TARGET: {
      const structure = position.lookFor(LOOK_STRUCTURES)[0]
      if (structure != null && structure instanceof StructureContainer) {
        this.containerId = structure.id
        return
      }
      const constructionSite = position.lookFor(LOOK_CONSTRUCTION_SITES)[0]
      if (constructionSite != null && constructionSite.structureType === STRUCTURE_CONTAINER) {
        this.containerConstructionSiteId = constructionSite.id as Id<ConstructionSite<STRUCTURE_CONTAINER>>
        return
      }
      PrimitiveLogger.fatal(`createConstructionSite returns ERR_INVALID_TARGET ${this.taskIdentifier}`)
      return
    }
    case ERR_NOT_OWNER:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.fatal(`createConstructionSite failed ${this.taskIdentifier}, ${result}`)
      return  // TODO: 毎tick行わないようにする
    }
    return
  }

  private runHarvester(
    objects: OwnedRoomObjects,
    source: Source,
    container: StructureContainer | null,
    containerConstructionSite: ConstructionSite<STRUCTURE_CONTAINER> | null
  ): ProblemFinder[] {
    const necessaryRoles: CreepRole[] = [CreepRole.Harvester, CreepRole.Mover, CreepRole.EnergyStore]
    const filterTaskIdentifier = this.taskIdentifier
    const minimumCreepCount = 1 // TODO: lifeが短くなってきたら次をspawnさせる
    const initialTask = (): CreepTask => {
      return MoveToTask.create(source.pos, 1)
    }
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
      this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, filterTaskIdentifier, minimumCreepCount, initialTask, CreepSpawnRequestPriority.High)
    ]

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskForHarvester(creep, source, container, containerConstructionSite)
      },
      creepPoolFilter,
    )

    return problemFinders
  }

  private createCreepInsufficiencyProblemFinder(
    objects: OwnedRoomObjects,
    necessaryRoles: CreepRole[],
    filterTaskIdentifier: TaskIdentifier | null,
    minimumCreepCount: number,
    initialTask: (() => CreepTask) | null,
    priority: CreepSpawnRequestPriority,
  ): ProblemFinder {
    const roomName = objects.controller.room.name
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, filterTaskIdentifier, minimumCreepCount)

    const problemFinderWrapper: ProblemFinder = {
      identifier: problemFinder.identifier,
      problemExists: () => problemFinder.problemExists(),
      getProblemSolvers: () => {
        const solver = problemFinder.getProblemSolvers()[0] // TODO: 選定する
        if (solver instanceof CreepInsufficiencyProblemSolver) {
          solver.codename = generateCodename(this.constructor.name, this.startTime)
          solver.initialTask = initialTask != null ? initialTask() : null
          solver.priority = priority
        }
        if (solver != null) {
          this.addChildTask(solver)
        }
        return [solver]
      },
    }

    return problemFinderWrapper
  }

  // ---- Creep Task ---- //
  private newTaskForHarvester(
    creep: Creep,
    source: Source,
    container: StructureContainer | null,
    containerConstructionSite: ConstructionSite<STRUCTURE_CONTAINER> | null
  ): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const harvestPosition = this.harvestPosition(container, containerConstructionSite)

      if (harvestPosition != null) {
        if (creep.pos.isEqualTo(harvestPosition) === true) {
          return RunApiTask.create(HarvestEnergyApiWrapper.create(source))
        }
        return MoveToTask.create(harvestPosition, 0)
      }
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
    }

    if (containerConstructionSite != null) {
      return RunApiTask.create(BuildApiWrapper.create(containerConstructionSite))
    }
    if (container != null && container.hits < container.hitsMax * 0.8) {
      return RunApiTask.create(RepairApiWrapper.create(container))
    }
    return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))  // TODO: dropは他の操作と同時に行える: parallel taskでharvestとdropを同時に行うようにする
  }

  private harvestPosition(
    container: StructureContainer | null,
    containerConstructionSite: ConstructionSite<STRUCTURE_CONTAINER> | null
  ): RoomPosition | null {
    if (container != null) {
      return container.pos
    }
    if (containerConstructionSite != null) {
      return containerConstructionSite.pos
    }
    return null
  }
}
