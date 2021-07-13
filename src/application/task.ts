import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Stateful } from "os/infrastructure/state"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomName } from "utility/room_name"
import type { TaskType } from "./task_decoder"
import type { TaskIdentifier } from "./task_identifier"
import type { TaskRequests } from "./task_requests"
import type { TaskState } from "./task_state"

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
        return this.emptyTaskRequests()
      }

      const taskRequests = this.children.map(task => task.runTask(roomResource))

      return this.run(roomResource, this.mergeTaskRequests(taskRequests))
    }, `${this.constructor.name}.run()`)()

    if (result == null) {
      PrimitiveLogger.fatal(`${this.constructor.name}.run() threw an exception`)
      return this.emptyTaskRequests()
    }
    return result
  }

  private emptyTaskRequests(): TaskRequests<T> {
    return {
      creepTaskAssignRequests: [],
      spawnRequests: [],
      towerRequests: [],
      problems: [],
      logs: [],
    }
  }

  private mergeTaskRequests(taskRequests: TaskRequests<P>[]): TaskRequests<P> {
    return {
      creepTaskAssignRequests: taskRequests.flatMap(requests => requests.creepTaskAssignRequests),
      spawnRequests: taskRequests.flatMap(requests => requests.spawnRequests),
      towerRequests: taskRequests.flatMap(requests => requests.towerRequests),
      problems: taskRequests.flatMap(requests => requests.problems),
      logs: taskRequests.flatMap(requests => requests.logs),
    }
  }

}
