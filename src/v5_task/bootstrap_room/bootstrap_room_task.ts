import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { TaskState } from "v5_task/task_state"
import { ClaimRoomTask } from "./claim_room_task"
import { UpgradeToRcl3Task } from "./upgrade_to_rcl3_task"

export interface BootstrapRoomTaskState extends TaskState {
  /** parent room name */
  r: RoomName

  /** target room name */
  tr: RoomName
}

export class BootstrapRoomTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
  }

  public encode(): BootstrapRoomTaskState {
    return {
      t: "BootstrapRoomTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.parentRoomName,
      tr: this.targetRoomName,
    }
  }

  public static decode(state: BootstrapRoomTaskState, children: Task[]): BootstrapRoomTask {
    return new BootstrapRoomTask(state.s, children, state.r, state.tr)
  }

  public static create(parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): BootstrapRoomTask {
    const children: Task[] = [
      ClaimRoomTask.create(parentRoomName, targetRoomName, waypoints),
      UpgradeToRcl3Task.create(parentRoomName, targetRoomName, waypoints),
    ]
    return new BootstrapRoomTask(Game.time, children, parentRoomName, targetRoomName)
  }

  public runTask(): TaskStatus {
    if (this.children.length <= 0) {
      return TaskStatus.Finished  // TODO: 引き継ぎ処理
    }

    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}
