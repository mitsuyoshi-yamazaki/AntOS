import { ProblemFinder } from "problem/problem_finder"
import { RoomName, roomTypeOf } from "utility/room_name"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"
import { RemoteRoomKeeperTask } from "./remote_room_keeper_task"

export interface RemoteRoomManagerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

export class RemoteRoomManagerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): RemoteRoomManagerTaskState {
    return {
      t: "RemoteRoomManagerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: RemoteRoomManagerTaskState): RemoteRoomManagerTask {
    const children = decodeTasksFrom(state.c)
    return new RemoteRoomManagerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): RemoteRoomManagerTask {
    const children: Task[] = []

    const exits = Game.map.describeExits(roomName)
    for (const [, neighbourRoomName] of Object.entries(exits)) {
      if (roomTypeOf(neighbourRoomName) === "normal") {
        children.push(RemoteRoomKeeperTask.create(roomName, neighbourRoomName))
      }
    }

    return new RemoteRoomManagerTask(Game.time, children, roomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}
