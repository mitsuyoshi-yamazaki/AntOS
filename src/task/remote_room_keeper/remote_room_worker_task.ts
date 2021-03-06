import { RoomName } from "utility/room_name"
import { EnergySourceTask } from "task/hauler/owned_room_energy_source_task"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { TaskState } from "task/task_state"
import { RemoteRoomHaulerTask } from "./remote_room_harvester_hauler_task"
import { RemoteRoomHarvesterTask } from "./remote_room_harvester_task"
import { RemoteRoomReserveTask } from "./remote_room_reserve_task"
import { ProblemFinder } from "problem/problem_finder"

export interface RemoteRoomWorkerTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName
}

/**
 * - concrete worker taskを実行する
 */
export class RemoteRoomWorkerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
  }

  public encode(): RemoteRoomWorkerTaskState {
    return {
      t: "RemoteRoomWorkerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName
    }
  }

  public static decode(state: RemoteRoomWorkerTaskState, children: Task[]): RemoteRoomWorkerTask {
    return new RemoteRoomWorkerTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoom: Room): RemoteRoomWorkerTask {
    const sources = targetRoom.find(FIND_SOURCES)
    const energySources: EnergySourceTask[] = sources.map(source => RemoteRoomHarvesterTask.create(roomName, source))
    const children: Task[] = [
      RemoteRoomHaulerTask.create(roomName, targetRoom.name, energySources),
      RemoteRoomReserveTask.create(roomName, targetRoom.name),
    ]
    return new RemoteRoomWorkerTask(Game.time, children, roomName, targetRoom.name)
  }

  public runTask(): TaskStatus {
    const problemFinders: ProblemFinder[] = []
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}
