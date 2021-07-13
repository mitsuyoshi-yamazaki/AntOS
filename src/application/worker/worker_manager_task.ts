import { ChildTask, Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { TaskRequests } from "application/task_requests"
import { TaskState } from "application/task_state"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomName } from "utility/room_name"
import { PrimitiveWorkerTask, PrimitiveWorkerTaskState } from "./primitive_worker_task"

type ConcreteWorkerTaskType = PrimitiveWorkerTask
type ConcreteWorkerTaskStateType = PrimitiveWorkerTaskState

function decodeWorkerTask(state: ConcreteWorkerTaskStateType): ConcreteWorkerTaskType {
  switch (state.t) {
  case "PrimitiveWorkerTask":
    return PrimitiveWorkerTask.decode(state)
  }
}

export interface WorkerManagerTaskState extends TaskState {
  /** child task states */
  c: {
    /** worker task state */
    w: ConcreteWorkerTaskStateType
  }
}

/**
 * - エネルギー回収、配分、Upgrade、Buildを行う
 */
export class WorkerManagerTask extends Task<void, void> {
  public readonly taskType = "WorkerManagerTask"
  public readonly identifier: TaskIdentifier
  public get children(): ChildTask<void>[] {
    return [
      this.workerTask,
    ]
  }

  protected constructor(
    public readonly startTime: number,
    public readonly roomName: RoomName,
    protected paused: number | null,
    private workerTask: ConcreteWorkerTaskType,
  ) {
    super(startTime, roomName, paused)

    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): WorkerManagerTaskState {
    return {
      ...super.encode(),
      c: {
        w: this.workerTask.encode(),
      },
    }
  }

  public static decode(state: WorkerManagerTaskState): WorkerManagerTask {
    const workerTask = decodeWorkerTask(state.c.w)
    return new WorkerManagerTask(state.s, state.r, state.p, workerTask)
  }

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests<void>): TaskRequests<void> {

    return requestsFromChildren
  }
}
