import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { TransferEnergyApiWrapper } from "object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { ProblemFinder } from "problem/problem_finder"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { MoveToTask } from "object_task/creep_task/meta_task/move_to_task"
import { RunApiTask } from "object_task/creep_task/combined_task/run_api_task"
import { HarvestEnergyApiWrapper } from "object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { DropResourceApiWrapper } from "object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { GetEnergyApiWrapper } from "object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { RunApisTask, RunApisTaskOptions } from "object_task/creep_task/combined_task/run_apis_task"
import { AnyCreepApiWrapper } from "object_task/creep_task/creep_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"

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
export class OwnedRoomHarvesterTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly source: Source,
    private containerConstructionSite: ConstructionSite<STRUCTURE_CONTAINER> | null,
    private container: StructureContainer | null,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.source.id}`
  }

  public encode(): OwnedRoomHarvesterTaskState {
    return {
      t: "OwnedRoomHarvesterTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      i: this.source.id,
      co: {
        c: this.containerConstructionSite?.id ?? null,
        i: this.container?.id ?? null,
      },
    }
  }

  public static decode(state: OwnedRoomHarvesterTaskState): OwnedRoomHarvesterTask | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      PrimitiveLogger.fatal(`Cannot get owned room source ${state.i} at ${roomLink(state.r)}`)
      return null
    }
    const children = decodeTasksFrom(state.c)
    const containerConstructionSite = ((): ConstructionSite<STRUCTURE_CONTAINER> | null => {
      if (state.co.c == null) {
        return null
      }
      return Game.getObjectById(state.co.c) ?? null
    })()
    const container = ((): StructureContainer | null => {
      if (state.co.i == null) {
        return null
      }
      return Game.getObjectById(state.co.i) ?? null
    })()
    return new OwnedRoomHarvesterTask(state.s, children, state.r, source, containerConstructionSite, container)
  }

  public static create(roomName: RoomName, source: Source): OwnedRoomHarvesterTask {
    return new OwnedRoomHarvesterTask(Game.time, [], roomName, source, null, null)
  }

  public description(): string {
    return this.taskIdentifier
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    this.checkContainer(objects)

    const problemFinders: ProblemFinder[] = []
    problemFinders.push(...this.runHarvester(objects))
    problemFinders.push(...this.runHauler(objects))

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private checkContainer(objects: OwnedRoomObjects): void {
    if (this.container != null) {
      return
    }
    if (this.containerConstructionSite != null) {
      return
    }
    this.createConstructionSite(objects)
  }

  private createConstructionSite(objects: OwnedRoomObjects): void {
    const constructionSite = this.source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).find(site => site.structureType === STRUCTURE_CONTAINER)
    if (constructionSite != null) {
      this.containerConstructionSite = constructionSite as ConstructionSite<STRUCTURE_CONTAINER>
      return
    }

    const spawn = objects.activeStructures.spawns[0]
    if (spawn == null) {
      PrimitiveLogger.fatal(`No spawns ${this.taskIdentifier}`)
      return
    }
    const resultPath = PathFinder.search(spawn.pos, { pos: this.source.pos, range: 1 })
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
    const result = this.source.room.createConstructionSite(position.x, position.y, STRUCTURE_CONTAINER)
    if (result !== OK) {
      PrimitiveLogger.fatal(`createConstructionSite failed ${this.taskIdentifier}, ${result}`)
      return  // TODO: 毎tick行わないようにする
    }
    return
  }

  private runHarvester(objects: OwnedRoomObjects): ProblemFinder[] {
    const necessaryRoles: CreepRole[] = [CreepRole.Harvester, CreepRole.Mover]
    const filterTaskIdentifier = this.taskIdentifier
    const minimumCreepCount = 1 // TODO: lifeが短くなってきたら次をspawnさせる
    const initialTask = (): CreepTask => {
      return MoveToTask.create(this.source.pos, 1)
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
        return this.newTaskForHarvester(creep)
      },
      creepPoolFilter,
    )

    return problemFinders
  }

  private runHauler(objects: OwnedRoomObjects): ProblemFinder[] {
    const necessaryRoles: CreepRole[] = [CreepRole.Hauler, CreepRole.Mover]
    const filterTaskIdentifier = null
    const minimumCreepCount = 2 * objects.sources.length // TODO: 算出する
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
      this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, filterTaskIdentifier, minimumCreepCount, null, CreepSpawnRequestPriority.Medium)
    ]

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskForHauler(creep, objects)
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
          solver.codename = generateCodename(this.constructor.name, this.roomName.split("").reduce((r, c) => r + c.charCodeAt(0), 0))
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
  private newTaskForHarvester(creep: Creep): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const harvestPosition = this.harvestPosition()

      if (harvestPosition != null) {
        if (creep.pos.isEqualTo(harvestPosition) === true) {
          return RunApiTask.create(HarvestEnergyApiWrapper.create(this.source))
        }
        return MoveToTask.create(harvestPosition, 0)
      }
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(this.source))
    }

    if (this.containerConstructionSite != null) {
      return RunApiTask.create(BuildApiWrapper.create(this.containerConstructionSite))
    }
    return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))  // TODO: dropは他の操作と同時に行える: parallel taskでharvestとdropを同時に行うようにする
  }

  private newTaskForHauler(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const harvestPosition = this.harvestPosition()

      if (harvestPosition != null) {
        if (creep.pos.isNearTo(harvestPosition) === true) {
          const droppedResource = creep.pos.findInRange(objects.droppedResources, 1)[0]
          if (droppedResource != null) {
            const apiWrappers: AnyCreepApiWrapper[] = [
              GetEnergyApiWrapper.create(droppedResource),
            ]
            if (this.container != null) {
              apiWrappers.push(GetEnergyApiWrapper.create(this.container))
            }
            // TODO: harvesterからも受け取る
            const options: RunApisTaskOptions = {
              waitUntilFinishedAll: false,
              ignoreFailure: false,
            }
            return RunApisTask.create(apiWrappers, options)
          }
        }
        return MoveToTask.create(harvestPosition, 1)
      }
      return null
    }

    if (objects.activeStructures.storage != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(objects.activeStructures.storage))
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }
    return null
  }

  private harvestPosition(): RoomPosition | null {
    if (this.container != null) {
      return this.container.pos
    }
    if (this.containerConstructionSite != null) {
      return this.containerConstructionSite.pos
    }
    return null
  }
}
