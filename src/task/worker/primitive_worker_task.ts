import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { ProblemFinder } from "problem/problem_finder"
import { HarvestEnergyApiWrapper } from "object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"

const creepCountForSource = 6

export interface PrimitiveWorkerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

/**
 * - harvest, build, upgrade全て行う
 */
export class PrimitiveWorkerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): PrimitiveWorkerTaskState {
    return {
      t: "PrimitiveWorkerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: PrimitiveWorkerTaskState): PrimitiveWorkerTask {
    const children = decodeTasksFrom(state.c)
    return new PrimitiveWorkerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(Game.time, [], roomName)
  }

  public description(): string {
    return `${this.constructor.name}_${this.roomName}`
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const necessaryRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]
    const filterTaskIdentifier = null
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
      this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, filterTaskIdentifier)
    ]

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskFor(creep, objects)
      },
      creepPoolFilter,
    )

    return TaskStatus.InProgress
  }

  // ---- Problem Solver ---- //
  private createCreepInsufficiencyProblemFinder(objects: OwnedRoomObjects, necessaryRoles: CreepRole[], filterTaskIdentifier: TaskIdentifier | null): ProblemFinder {
    const roomName = objects.controller.room.name
    const minimumCreepCount = creepCountForSource * objects.sources.length
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, filterTaskIdentifier, minimumCreepCount)

    const problemFinderWrapper: ProblemFinder = {
      identifier: problemFinder.identifier,
      problemExists: () => problemFinder.problemExists(),
      getProblemSolvers: () => {
        const solver = problemFinder.getProblemSolvers()[0] // TODO: 選定する
        if (solver instanceof CreepInsufficiencyProblemSolver) {
          solver.codename = generateCodename(this.constructor.name, this.roomName.split("").reduce((r, c) => r + c.charCodeAt(0), 0))
          solver.priority = CreepSpawnRequestPriority.Medium
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
  private newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const source = objects.getSource(creep.pos)
      if (source == null) {
        return null
      }
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    const damagedStructure = objects.getRepairStructure()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
    }
    const constructionSite = objects.getConstructionSite()
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller))
  }
}
