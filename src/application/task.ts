import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Stateful } from "os/infrastructure/state"
import type { CreepName } from "prototype/creep"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { RoomName } from "utility/room_name"
import type { TaskType } from "./task_decoder"
import type { TaskIdentifier } from "./task_identifier"
import type { TaskLogRequest } from "./task_logger"
import type { CreepTaskAssignTaskRequest, SpawnTaskRequestType, TowerActionTaskRequest } from "./task_request"
import { emptyTaskRequests, TaskRequests } from "./task_requests"
import type { TaskState } from "./task_state"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Task<T, P> {
  overrideCreepTask?(creepName: CreepName, request1: CreepTaskAssignTaskRequest, request2: CreepTaskAssignTaskRequest): CreepTaskAssignTaskRequest
}

export interface ChildTask<P> {
  runTask(roomResource: OwnedRoomResource): TaskRequests<P>
}

export abstract class Task<T, P> implements Stateful, ChildTask<T> {
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
  abstract readonly children: ChildTask<P>[]

  /** 相似のタスクに引き継げるものは共通のTaskIdentifierを返す */
  abstract readonly identifier: TaskIdentifier
  abstract run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests<P>): TaskRequests<T>

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
  public runTask(roomResource: OwnedRoomResource): TaskRequests<T> {
    const result = ErrorMapper.wrapLoop((): TaskRequests<T> => {
      if (this.isPaused() === true) {
        return emptyTaskRequests()
      }

      const taskRequests = this.children.map(task => task.runTask(roomResource))

      return this.run(roomResource, this.mergeTaskRequests(taskRequests))
    }, `${this.constructor.name}.run()`)()

    if (result == null) {
      PrimitiveLogger.fatal(`${this.constructor.name}.run() threw an exception`)
      return emptyTaskRequests()
    }
    return result
  }

  private mergeTaskRequests(taskRequests: TaskRequests<P>[]): TaskRequests<P> {
    const creepTaskAssignRequests = new Map<CreepName, CreepTaskAssignTaskRequest>()
    const spawnRequests: SpawnTaskRequestType[] = []
    const towerRequests: TowerActionTaskRequest[] = []
    const problems: P[] = []
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
