import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Stateful } from "os/infrastructure/state"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomName } from "utility/room_name"
import type { TaskType } from "./task_decoder"
import type { TaskLogger } from "./task_logger"
import type { TaskRequests } from "./task_requests"
import type { TaskState } from "./task_state"
import { TaskStatus } from "./task_status"

export type TaskIdentifier = string

export abstract class Task implements Stateful {
  protected constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    protected paused: number | null,
  ) {
    if (this.isPaused() !== true) {
      this.paused = null
    }
  }

  // ---- API ---- //
  abstract readonly taskType: TaskType

  /** 相似のタスクに引き継げるものは共通のTaskIdentifierを返す */
  abstract readonly identifier: TaskIdentifier
  abstract run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests, logger: TaskLogger): TaskStatus

  public encode(): TaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      p: this.paused,
    }
  }

  protected hasChildTask(taskIdentifier: TaskIdentifier): boolean {
    return this.children.some(task => task.identifier === taskIdentifier)
  }

  protected addChildTask(task: Task): void {
    if (this.hasChildTask(task.identifier) === true) {
      return
    }
    this.children.push(task)
  }

  protected removeChildTask(task: Task): void {
    const index = this.children.indexOf(task)
    if (index < 0) {
      return
    }
    this.children.splice(index, 1)
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
  public runTask(roomResource: OwnedRoomResource, logger: TaskLogger): TaskStatus {
    const result = ErrorMapper.wrapLoop((): TaskStatus => {
      if (this.isPaused() === true) {
        return TaskStatus.InProgress(emptyTaskRequests())
      }

      const finishedTasks: Task[] = []
      const taskRequests: TaskRequests[] = []

      this.children.forEach(task => {
        const status = task.runTask(roomResource, logger)
        switch (status.taskStatusType) {
        case "in progress":
          taskRequests.push(status.taskRequests)
          return
        case "finished":
          finishedTasks.push(task)
          return
        case "failed":
          finishedTasks.push(task)
          taskRequests.push(status.taskRequests)
          return
        }
      })

      finishedTasks.forEach(task => this.removeChildTask(task))

      return this.run(roomResource, mergeTaskRequests(taskRequests), logger)
    }, `${this.constructor.name}.run()`)()

    if (result == null) {
      PrimitiveLogger.fatal(`${this.constructor.name}.run() threw exception`)
      return TaskStatus.InProgress(emptyTaskRequests())
    }
    return result
  }
}

function emptyTaskRequests(): TaskRequests {
  return {
    spawnRequests: [],
    towerRequests: [],
    problems: [],
  }
}

function mergeTaskRequests(taskRequests: TaskRequests[]): TaskRequests {
  return {
    spawnRequests: taskRequests.flatMap(requests => requests.spawnRequests),
    towerRequests: taskRequests.flatMap(requests => requests.towerRequests),
    problems: taskRequests.flatMap(requests => requests.problems),
  }
}
