import { ProblemFinder } from "v5_problem/problem_finder"
import type { RoomName } from "shared/utility/room_name_types"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "v5_task/task_state"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepInsufficiencyProblemFinder } from "v5_problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepInsufficiencyProblemSolver } from "v5_task/creep_spawn/creep_insufficiency_problem_solver"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { World } from "world_info/world_info"

export interface GeneralCreepWorkerTaskCreepRequest {
  necessaryRoles: CreepRole[]
  taskIdentifier: TaskIdentifier | null
  numberOfCreeps: number
  codename: string | null
  initialTask: CreepTask | null
  priority: CreepSpawnRequestPriority
  body: BodyPartConstant[] | null
}

export interface GeneralCreepWorkerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

/**
 * - 構想
 *   - 一般的なタスク、「このような構成のcreepをn体ここで何をさせる」を実行させるabstractクラス
 */
export abstract class GeneralCreepWorkerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  protected constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  abstract encode(): GeneralCreepWorkerTaskState
  abstract creepFileterRoles(): CreepRole[] | null
  abstract creepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest | null
  abstract newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const problemFinders: ProblemFinder[] = [
    ]

    const creepFileterRoles = this.creepFileterRoles()
    const request = this.creepRequest(objects)
    if (request != null) {
      const problemFinder = new CreepInsufficiencyProblemFinder(this.roomName, creepFileterRoles, request.necessaryRoles, request.taskIdentifier, request.numberOfCreeps)
      const problemFinderWrapper: ProblemFinder = {
        identifier: problemFinder.identifier,
        problemExists: () => problemFinder.problemExists(),
        getProblemSolvers: () => {
          const solver = problemFinder.getProblemSolvers()[0]
          if (!(solver instanceof CreepInsufficiencyProblemSolver)) {
            return []
          }
          if (request.codename != null) {
            solver.codename = request.codename
          }
          if (request.initialTask != null) {
            solver.initialTask = request.initialTask
          }
          if (request.body != null) {
            solver.body = request.body
          }
          solver.priority = request.priority

          return [solver]
        }
      }
      problemFinders.push(problemFinderWrapper)
    }

    this.checkProblemFinders(problemFinders)

    const filter = ((): CreepPoolFilter => {
      if (creepFileterRoles == null) {
        return () => true
      }
      const roles = creepFileterRoles
      return creep => hasNecessaryRoles(creep, roles)
    })()

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      request?.taskIdentifier ?? null,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskFor(creep, objects)
      },
      filter,
    )

    return TaskStatus.InProgress
  }
}
