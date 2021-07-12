import { Task, TaskIdentifier } from "application/task"
import { TaskLogger } from "application/task_logger"
import { TaskRequests } from "application/task_requests"
import { TaskState } from "application/task_state"
import { TaskStatus } from "application/task_status"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomName } from "utility/room_name"

export interface RoomKeeperTaskState extends TaskState {

}

export class RoomKeeperTask extends Task {
  public readonly taskType = "RoomKeeperTask"
  public readonly identifier: TaskIdentifier

  protected constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    protected paused: number | null,
  ) {
    super(startTime, children, roomName, paused)

    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): TaskState {
    return {
      ...super.encode(),
    }
  }

  public static decode(state: RoomKeeperTaskState, children: Task[]): RoomKeeperTask {
    return new RoomKeeperTask(state.s, children, state.r, state.p)
  }

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests, logger: TaskLogger): TaskStatus {
    return TaskStatus.InProgress(requestsFromChildren)
  }
}
