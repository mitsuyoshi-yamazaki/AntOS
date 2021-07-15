import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { CreepTaskAssignTaskRequest } from "application/task_request"
import { emptyTaskRequests, TaskRequests } from "application/task_requests"
import { TaskState } from "application/task_state"
import { WorkerManagerTask, WorkerManagerTaskState } from "application/task/worker/worker_manager_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import type { CreepName } from "prototype/creep"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { RoomName } from "utility/room_name"
import { TaskRequestHandler } from "./task_request_handler"
import { CreepProblemMap } from "room_resource/room_resources"

export interface RoomKeeperTaskState extends TaskState {
  /** child task states */
  c: {
    /** worker manager task state */
    w: WorkerManagerTaskState
  }
}

export class RoomKeeperTask extends Task {
  public readonly taskType = "RoomKeeperTask"
  public readonly identifier: TaskIdentifier
  public get children(): Task[] {
    return [
      this.workerManagerTask
    ]
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

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests, creepProblems: CreepProblemMap | null): TaskRequests {
    if (creepProblems != null && creepProblems.size > 0) {
      PrimitiveLogger.programError(`${this.identifier} Unexpectedly found ${creepProblems.size} creep problems`)
    }

    const unresolvedProblems = this.taskRequestHandler.execute(requestsFromChildren, roomResource)

    return emptyTaskRequests()
  }
}
