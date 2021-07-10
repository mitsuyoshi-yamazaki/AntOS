import { RoomInvadedProblemFinder } from "problem/invasion/room_invaded_problem_finder"
import { ProblemFinder } from "problem/problem_finder"
import { OwnedRoomDecayedStructureProblemFinder } from "problem/structure/owned_room_decayed_structure_problem_finder"
import { RoomName } from "utility/room_name"
import { CreateConstructionSiteTask } from "task/room_planing/create_construction_site_task"
import { OwnedRoomScoutTask } from "task/scout/owned_room_scout_task"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { WorkerTask } from "task/worker/worker_task"
import { OwnedRoomObjects } from "world_info/room_info"
import { RemoteRoomManagerTask } from "task/remote_room_keeper/remote_room_manager_task"
import { TaskState } from "task/task_state"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { CreepSpawnRequest, CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepInsufficiencyProblemFinder } from "problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepRole } from "prototype/creep_role"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { CreepTask } from "object_task/creep_task/creep_task"

export interface GeneralCreepWorkerTaskCreepRequest {
  necessaryRoles: CreepRole[]
  taskIdentifier: TaskIdentifier
  numberOfCreeps: number
  codename: string | null
  initialTask: CreepTask
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

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  abstract encode(): GeneralCreepWorkerTaskState
  abstract creepFilter(): CreepPoolFilter
  abstract creepRequest(): GeneralCreepWorkerTaskCreepRequest

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const request = this.creepRequest()
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

        return [solver]
      }
    }

    const problemFinders: ProblemFinder[] = [
      problemFinderWrapper,
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}
