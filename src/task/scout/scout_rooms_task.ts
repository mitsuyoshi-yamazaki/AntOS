import { ProblemFinder } from "problem/problem_finder"
import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "task/task_state"

export interface ScoutRoomsTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room names */
  tr: RoomName[]
}

export class ScoutRoomsTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomNames: RoomName[],
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): ScoutRoomsTaskState {
    return {
      t: "ScoutRoomsTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomNames,
    }
  }

  public static decode(state: ScoutRoomsTaskState, children: Task[]): ScoutRoomsTask {
    return new ScoutRoomsTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoomNames: RoomName[]): ScoutRoomsTask {
    return new ScoutRoomsTask(Game.time, [], roomName, targetRoomNames)
  }

  public runTask(): TaskStatus {
    const problemFinders: ProblemFinder[] = []  // TODO: creep insufficiency
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}
