import { Problem } from "application/problem"
import { ChildTask, Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { CreepTaskAssignTaskRequest } from "application/task_request"
import { emptyTaskRequests, TaskRequests } from "application/task_requests"
import { TaskState } from "application/task_state"
import { WorkerManagerTask, WorkerManagerTaskState } from "application/worker/worker_manager_task"
import { CreepApiError } from "object_task/creep_task/creep_api"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import type { CreepName } from "prototype/creep"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { RoomName } from "utility/room_name"
import { TaskRequestHandler } from "./task_request_handler"

export interface RoomKeeperTaskState extends TaskState {
  /** child task states */
  c: {
    /** worker manager task state */
    w: WorkerManagerTaskState
  }
}

export class RoomKeeperTask extends Task<void, void> {
  public readonly taskType = "RoomKeeperTask"
  public readonly identifier: TaskIdentifier
  public get children(): ChildTask<void>[] {
    return []
  }

  private readonly taskRequestHandler = new TaskRequestHandler()

  protected constructor(
    public readonly startTime: number,
    public readonly roomName: RoomName,
    protected paused: number | null,
    private workerManagerTask: WorkerManagerTask
  ) {
    super(startTime, roomName, paused)

    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): RoomKeeperTaskState {
    return {
      ...super.encode(),
      c: {
        w: this.workerManagerTask.encode(),
      },
    }
  }

  public static decode(state: RoomKeeperTaskState): RoomKeeperTask {
    const workerManagerTask = WorkerManagerTask.decode(state.c.w)
    return new RoomKeeperTask(state.s, state.r, state.p, workerManagerTask)
  }

  public static create(roomName: RoomName): RoomKeeperTask {
    const workerManagerTask = WorkerManagerTask.create(roomName)
    return new RoomKeeperTask(Game.time, roomName, null, workerManagerTask)
  }

  public overrideCreepTask(creepName: CreepName, request1: CreepTaskAssignTaskRequest, request2: CreepTaskAssignTaskRequest): CreepTaskAssignTaskRequest {
    PrimitiveLogger.programError(`${this.identifier} overrideCreepTask() is not implemented yet (${request1.task})`)
    return request1
  }

  public problemOf(creepApiError: CreepApiError): void {
    PrimitiveLogger.programError(`${this.identifier} unexpectedly found creep API erorr: ${creepApiError.api}, ${creepApiError.error}`)
  }

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests<void>): TaskRequests<void> {
    const unresolvedProblems = this.taskRequestHandler.execute(requestsFromChildren, roomResource)

    return emptyTaskRequests()
  }
}
