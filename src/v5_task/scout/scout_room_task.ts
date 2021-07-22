// import { ProblemFinder } from "problem/problem_finder"
import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
// import { decodeTasksFrom } from "task/task_decoder"
// import { OwnedRoomObjects } from "world_info/room_info"
// import { RoomInvisibleProblemFinder } from "problem/remote_room/room_invisible_problem_finder"
// import { RoomInvisibleProblemSolver } from "./room_invisible_problem_solver"
// import { generateCodename } from "utility/unique_id"
import { TaskState } from "v5_task/task_state"

export interface ScoutRoomTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]
}

export class ScoutRoomTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
  }

  public encode(): ScoutRoomTaskState {
    return {
      t: "ScoutRoomTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
      w: this.waypoints,
    }
  }

  public static decode(state: ScoutRoomTaskState, children: Task[]): ScoutRoomTask {
    // const children = decodeTasksFrom(state.c)
    return new ScoutRoomTask(state.s, children, state.r, state.tr, state.w)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): ScoutRoomTask {
    return new ScoutRoomTask(Game.time, [], roomName, targetRoomName, waypoints)
  }

  public runTask(): TaskStatus {
    // const roomInvisibleProblemFinder = new RoomInvisibleProblemFinder(objects, this.targetRoomName)
    // const problemFinderWrapper: ProblemFinder = {
    //   identifier: roomInvisibleProblemFinder.identifier,
    //   problemExists: () => roomInvisibleProblemFinder.problemExists(),
    //   getProblemSolvers: () => {
    //     const solver = roomInvisibleProblemFinder.getProblemSolvers()[0]
    //     if (solver instanceof RoomInvisibleProblemSolver) {
    //       solver.codename = generateCodename(this.constructor.name, this.startTime)
    //       solver.waypoints = this.waypoints
    //     }
    //     return [solver]
    //   },
    // }

    // const problemFinders: ProblemFinder[] = [
    //   problemFinderWrapper
    // ]
    // this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}
