import { ProblemFinder } from "problem/problem_finder"
import { RoomInvisibleProblemFinder } from "problem/remote_room/room_invisible_problem_finder"
import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"

export interface RemoteRoomKeeperTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName
}

// TODO: reserve
export class RemoteRoomKeeperTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): RemoteRoomKeeperTaskState {
    return {
      t: "RemoteRoomKeeperTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
    }
  }

  public static decode(state: RemoteRoomKeeperTaskState): RemoteRoomKeeperTask {
    const children = decodeTasksFrom(state.c)
    return new RemoteRoomKeeperTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName): RemoteRoomKeeperTask {
    return new RemoteRoomKeeperTask(Game.time, [], roomName, targetRoomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const problemFinders: ProblemFinder[] = [
      new RoomInvisibleProblemFinder(objects, this.targetRoomName),
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}
