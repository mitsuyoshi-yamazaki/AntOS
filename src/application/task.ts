import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Stateful } from "os/infrastructure/state"
import type { CreepName } from "prototype/creep"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { RoomName } from "utility/room_name"
import { Problem } from "./problem"
import type { TaskType } from "./task_decoder"
import type { TaskIdentifier } from "./task_identifier"
import type { TaskLogRequest } from "./task_logger"
import type { CreepTaskAssignTaskRequest, SpawnTaskRequestType, TowerActionTaskRequest } from "./task_request"
import { emptyTaskRequests, TaskRequests } from "./task_requests"
import type { TaskState } from "./task_state"

export interface Task {
  overrideCreepTask?(creepName: CreepName, request1: CreepTaskAssignTaskRequest, request2: CreepTaskAssignTaskRequest): CreepTaskAssignTaskRequest
}

export abstract class Task implements Stateful {
  protected constructor(
    public readonly startTime: number,
    public readonly roomName: RoomName,
    protected paused: number | null,
  ) {
    if (this.isPaused() !== true) {
      this.paused = null
    }
  }

  // ---- API ---- //
  abstract readonly taskType: TaskType
  abstract readonly children: Task[]

  /** 相似のタスクに引き継げるものは共通のTaskIdentifierを返す */
  abstract readonly identifier: TaskIdentifier
  abstract run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests): TaskRequests

  public encode(): TaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      r: this.roomName,
      p: this.paused,
    }
  }

  // ---- Private ---- //
  private isPaused(): boolean {
    if (this.paused == null) {
      return false
    }
    if (this.paused === 0) {
      return true
    }
    return this.paused < Game.time
  }

  /** TaskRunner以外から直接呼び出さないこと */
  public runTask(roomResource: OwnedRoomResource): TaskRequests {
    const result = ErrorMapper.wrapLoop((): TaskRequests => {
      if (this.isPaused() === true) {
        return emptyTaskRequests()
      }

      const taskRequests = this.children.map(task => task.runTask(roomResource))
      const requestsFromChildren = this.mergeTaskRequests(taskRequests)

      const requests = this.run(roomResource, requestsFromChildren)
      return requests
    }, `${this.constructor.name}.run()`)()

    if (result == null) {
      PrimitiveLogger.fatal(`${this.constructor.name}.run() threw an exception`)
      return emptyTaskRequests()
    }
    return result
  }

  private mergeTaskRequests(taskRequests: TaskRequests[]): TaskRequests {
    const creepTaskAssignRequests = new Map<CreepName, CreepTaskAssignTaskRequest>()
    const spawnRequests: SpawnTaskRequestType[] = []
    const towerRequests: TowerActionTaskRequest[] = []
    const problems: Problem[] = []
    const logs: TaskLogRequest[] = []
    taskRequests.forEach(request => {
      request.creepTaskAssignRequests.forEach((creepTaskRequest, creepName) => {
        const storedTaskRequest = creepTaskAssignRequests.get(creepName)
        if (storedTaskRequest == null) {
          creepTaskAssignRequests.set(creepName, creepTaskRequest)
        } else {
          if (this.overrideCreepTask != null) {
            const overridedTaskRequest = this.overrideCreepTask(creepName, creepTaskRequest, storedTaskRequest)
            creepTaskAssignRequests.set(creepName, overridedTaskRequest)
          } else {
            // do nothing
          }
        }
      })
      spawnRequests.push(...request.spawnRequests)
      towerRequests.push(...request.towerRequests)
      problems.push(...request.problems)
      logs.push(...request.logs)
    })

    return {
      creepTaskAssignRequests,
      spawnRequests,
      towerRequests,
      problems,
      logs,
    }
  }
}
