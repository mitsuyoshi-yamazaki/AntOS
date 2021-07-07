import { RoomName } from "utility/room_name"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
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
import { BuildContainerTask } from "task/build/build_container_task"
import { roomLink } from "utility/log"
import { placeRoadConstructMarks } from "script/pathfinder"
import { TaskState } from "task/task_state"

export interface OwnedRoomHarvesterTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** source id */
  i: Id<Source>

  /** container */
  co: {
    /** id */
    i: Id<StructureContainer> | null
  }
}

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
        i: this.containerId ?? null,
      },
    }
  }

  public static decode(state: OwnedRoomHarvesterTaskState, children: Task[]): OwnedRoomHarvesterTask | null {
    return new OwnedRoomHarvesterTask(state.s, children, state.r, state.i, state.co.i)
  }

  public static create(roomName: RoomName, source: Source): OwnedRoomHarvesterTask {
    return new OwnedRoomHarvesterTask(Game.time, [], roomName, source.id, null)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus { // TODO: finishedTasksからcontainerをとる
    const source = Game.getObjectById(this.sourceId)
    if (source == null) {
      PrimitiveLogger.fatal(`${this.description()} source ${this.sourceId} not found`)
      return TaskStatus.Failed
    }

    const container = ((): StructureContainer | null => {
      if (this.containerId == null) {
        return null
      }
      const stored = Game.getObjectById(this.containerId)
      if (stored == null) {
        this.containerId = null
        return null
      }
      return stored
    })()

    const problemFinders: ProblemFinder[] = []

    if (container != null) {
      problemFinders.push(...this.runHarvester(objects, source, container))
    } else {
      this.checkContainer(objects, childTaskResults.finishedTasks, source)
    }

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private runHarvester(
    objects: OwnedRoomObjects,
    source: Source,
    container: StructureContainer,
  ): ProblemFinder[] {
    const necessaryRoles: CreepRole[] = [CreepRole.Harvester, CreepRole.Mover, CreepRole.EnergyStore]
    const minimumCreepCount = 1 // TODO: lifeが短くなってきたら次をspawnさせる
    const initialTask = (): CreepTask => {
      return MoveToTask.create(source.pos, 1)
    }
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
      this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, minimumCreepCount, initialTask, CreepSpawnRequestPriority.High)
    ]

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskForHarvester(creep, source, container)
      },
      creepPoolFilter,
    )

    return problemFinders
  }

  private createCreepInsufficiencyProblemFinder(
    objects: OwnedRoomObjects,
    necessaryRoles: CreepRole[],
    minimumCreepCount: number,
    initialTask: (() => CreepTask) | null,
    priority: CreepSpawnRequestPriority,
  ): ProblemFinder {
    const roomName = objects.controller.room.name
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, this.taskIdentifier, minimumCreepCount)

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
    container: StructureContainer,
  ): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const harvestPosition = container.pos
      if (creep.pos.isEqualTo(harvestPosition) === true) {
        return RunApiTask.create(HarvestEnergyApiWrapper.create(source))
      }
      return MoveToTask.create(harvestPosition, 0)
    }

    if (container.hits < container.hitsMax * 0.8) {
      return RunApiTask.create(RepairApiWrapper.create(container))
    }
    return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))  // TODO: dropは他の操作と同時に行える: parallel taskでharvestとdropを同時に行うようにする
  }

  // ---- Build Container ---- //
  private checkContainer(objects: OwnedRoomObjects, finishedChildTasks: Task[], source: Source): void {
    const finishedBuildContainerTask = finishedChildTasks.find(task => task instanceof BuildContainerTask) as BuildContainerTask | null
    if (finishedBuildContainerTask != null) {
      const containerId = finishedBuildContainerTask.container?.id ?? null
      if (containerId == null) {
        return
      }
      this.containerId = containerId
      const container = Game.getObjectById(containerId)
      if (container != null) {
        this.placeRoadConstructMarks(objects, container)
      }
      return
    }

    const buildContainerTask = this.children.find(task => task instanceof BuildContainerTask) as BuildContainerTask | null
    if (buildContainerTask != null) {
      return
    }
    this.launchBuildContainerTask(objects, source)
  }

  private launchBuildContainerTask(objects: OwnedRoomObjects, source: Source): void {
    const roomName = objects.controller.room.name
    const pathStartPosition = objects.activeStructures.storage?.pos ?? objects.activeStructures.spawns[0]?.pos
    if (pathStartPosition == null) {
      PrimitiveLogger.fatal(`No spawns or storage ${this.taskIdentifier} in ${roomLink(roomName)}`)
      return
    }
    const resultPath = PathFinder.search(pathStartPosition, { pos: source.pos, range: 1 })
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
    this.addChildTask(BuildContainerTask.create(roomName, position, this.taskIdentifier))
    return
  }

  private placeRoadConstructMarks(objects: OwnedRoomObjects, container: StructureContainer): void {
    const storage = objects.activeStructures.storage
    if (storage == null) {
      return
    }

    const codename = generateCodename(this.constructor.name, this.startTime)
    const room = objects.controller.room
    placeRoadConstructMarks(room, storage, container, codename)
  }
}
