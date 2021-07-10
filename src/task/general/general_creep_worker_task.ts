import { ProblemFinder } from "problem/problem_finder"
import { RoomName } from "utility/room_name"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "task/task_state"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepInsufficiencyProblemFinder } from "problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepRole } from "prototype/creep_role"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { CreepTask } from "object_task/creep_task/creep_task"
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
  abstract creepFileter(): CreepPoolFilter
  abstract creepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest | null
  abstract newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const problemFinders: ProblemFinder[] = [
    ]

    const request = this.creepRequest(objects)
    if (request != null) {
      const problemFinder = new CreepInsufficiencyProblemFinder(this.roomName, request.necessaryRoles, request.taskIdentifier, request.numberOfCreeps)
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

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskFor(creep, objects)
      },
      creep => this.creepFileter()(creep),
    )

    return TaskStatus.InProgress
  }
}
