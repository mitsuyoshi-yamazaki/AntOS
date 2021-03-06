import { ProblemFinder } from "problem/problem_finder"
import { RoomInvisibleProblemFinder } from "problem/remote_room/room_invisible_problem_finder"
import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "task/task_state"
import { RemoteRoomHarvesterTask } from "./remote_room_harvester_task"
import { World } from "world_info/world_info"
import { RemoteRoomWorkerTask } from "./remote_room_worker_task"

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

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
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

  public static decode(state: RemoteRoomKeeperTaskState, children: Task[]): RemoteRoomKeeperTask {
    return new RemoteRoomKeeperTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName): RemoteRoomKeeperTask {
    const children: Task[] = [
    ]
    return new RemoteRoomKeeperTask(Game.time, children, roomName, targetRoomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const problemFinders: ProblemFinder[] = [
      new RoomInvisibleProblemFinder(objects, this.targetRoomName),
    ]
    this.checkProblemFinders(problemFinders)

    // if (this.targetRoomName === "W25S29" && this.children.some(task => task instanceof RemoteRoomHarvesterTask) !== true) {
    //   const room = World.rooms.get(this.targetRoomName)
    //   if (room != null) {
    //     const sources = room.find(FIND_SOURCES)
    //     sources.forEach(source => {
    //       console.log(`RemoteRoomHarvesterTask added ${source}`)
    //       this.addChildTask(RemoteRoomHarvesterTask.create(this.roomName, source))
    //     })
    //   }
    // }
    const harvesterTask = this.children.find(task => task instanceof RemoteRoomHarvesterTask)
    if (harvesterTask != null) {
      this.removeChildTask(harvesterTask)
    }

    const targetRoom = World.rooms.get(this.targetRoomName)
    if (this.targetRoomName === "W15S28" && targetRoom != null && this.children.some(task => task instanceof RemoteRoomWorkerTask) !== true) {
      this.addChildTask(RemoteRoomWorkerTask.create(this.roomName, targetRoom))
    }

    return TaskStatus.InProgress
  }
}
