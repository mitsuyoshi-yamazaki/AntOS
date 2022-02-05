import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName, roomTypeOf } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { RemoteRoomKeeperTask } from "./remote_room_keeper_task"
import { TaskState } from "v5_task/task_state"

export interface RemoteRoomManagerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

/**
 * - RemoteRoomManager
 *   - RemoteRoomDefender
 *   - RemoteRoomKeeper(s)
 *     - RemoteRoomWorker
 *       - RemoteRoomReserver
 *       - RemoteRoomHarvester
 *       - RemoteRoomHauler
 */
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
    const parentRoomStatus = Game.map.getRoomStatus(roomName)?.status // sim環境ではundefinedが返る

    const exits = Game.map.describeExits(roomName)
    if (exits != null) { // sim環境ではundefinedが返る
      Object.entries(exits).forEach(([, neighbour]) => {
        if (roomTypeOf(neighbour) !== "normal") {
          return
        }
        const roomStatus = Game.map.getRoomStatus(neighbour)
        if (roomStatus.status !== parentRoomStatus) {
          return
        }
        children.push(RemoteRoomKeeperTask.create(roomName, neighbour))
      })
    }

    return new RemoteRoomManagerTask(Game.time, children, roomName)
  }

  public runTask(): TaskStatus {
    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    // const keeper = this.children.find(task => {
    //   if (!(task instanceof RemoteRoomKeeperTask)) {
    //     return false
    //   }
    //   if (Environment.world === "persistent world" && Environment.shard === "shard2" && task.roomName === "W47S2" && task.targetRoomName === "W47S3") {
    //     return true
    //   }
    //   return false
    // })
    // if (keeper != null) {
    //   PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} remove remote room keeper task`)
    //   this.removeChildTask(keeper)
    // }

    return TaskStatus.InProgress
  }
}
