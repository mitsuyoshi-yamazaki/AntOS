import { Problem } from "application/problem"
import { ChildTask, Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { TaskRequests } from "application/task_requests"
import { TaskState } from "application/task_state"
import { WorkerManagerTask, WorkerManagerTaskState } from "application/worker/worker_manager_task"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomName } from "utility/room_name"
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

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests<void>): TaskRequests<void> {
    const unresolvedRequests = this.taskRequestHandler.execute(requestsFromChildren, roomResource)

    return unresolvedRequests
  }
}

class DummyProblem implements Problem {
  public readonly identifier = ""
  public readonly taskIdentifier = ""
}
