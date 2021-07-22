import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName, roomTypeOf } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { TaskState } from "v5_task/task_state"

export interface OwnedRoomScoutTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** energy harvestable neighbour room names */
  n: RoomName[]
}

// TODO: まずは手動でroom.memoryを編集する
/**
 * - Owned roomの周辺の情報を取得する斥候の管理タスク
 * - 斥候の常時展開はしない
 */
export class OwnedRoomScoutTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly harvestableNeighbourRoomNames: RoomName[],  // TODO: Remote_系タスクに移す
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): OwnedRoomScoutTaskState {
    return {
      t: "OwnedRoomScoutTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      n: this.harvestableNeighbourRoomNames,
    }
  }

  public static decode(state: OwnedRoomScoutTaskState, children: Task[]): OwnedRoomScoutTask {
    return new OwnedRoomScoutTask(state.s, children, state.r, state.n)
  }

  public static create(roomName: RoomName): OwnedRoomScoutTask {
    const neighbourRoomNames: RoomName[] = []
    const exits = Game.map.describeExits(roomName)
    for (const [, neighbour] of Object.entries(exits)) {
      if (roomTypeOf(neighbour) === "normal") {
        neighbourRoomNames.push(neighbour)
      }
    }
    return new OwnedRoomScoutTask(Game.time, [], roomName, neighbourRoomNames)
  }

  public runTask(): TaskStatus {
    const problemFinders: ProblemFinder[] = []
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}
