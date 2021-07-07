import { ProblemFinder } from "problem/problem_finder"
import { RoomName, roomTypeOf } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { RemoteRoomKeeperTask } from "./remote_room_keeper_task"
import { TaskState } from "task/task_state"

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

  public static decode(state: RemoteRoomManagerTaskState, children: Task[]): RemoteRoomManagerTask {
    return new RemoteRoomManagerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): RemoteRoomManagerTask {
    const children: Task[] = []
    const parentRoomStatus = Game.map.getRoomStatus(roomName).status

    const exits = Game.map.describeExits(roomName)
    for (const [, neighbourRoomName] of Object.entries(exits)) {
      if (roomTypeOf(neighbourRoomName) !== "normal") {
        continue
      }
      const roomStatus = Game.map.getRoomStatus(neighbourRoomName)
      if (roomStatus.status !== parentRoomStatus) {
        continue
      }
      children.push(RemoteRoomKeeperTask.create(roomName, neighbourRoomName))
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
