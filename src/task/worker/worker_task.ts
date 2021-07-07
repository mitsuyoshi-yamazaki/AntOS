import { RoomName } from "prototype/room"
import { OwnedRoomHarvesterTask } from "task/harvester/owned_room_harvester_task"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralWorkerTask } from "./general_worker_task"
import { PrimitiveWorkerTask } from "./primitive_worker_task"

export interface WorkerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

/**
 * - concrete worker taskを実行する
 */
export class WorkerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): WorkerTaskState {
    return {
      t: "WorkerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: WorkerTaskState): WorkerTask {
    const children = decodeTasksFrom(state.c)
    return new WorkerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): WorkerTask {
    const children: Task[] = [
      PrimitiveWorkerTask.create(roomName),
    ]
    return new WorkerTask(Game.time, children, roomName)
  }

  public description(): string {
    return `${this.constructor.name}_${this.roomName}`
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    this.checkPrimitiveWorkerTask(objects)

    // TODO: creepがいなくなった場合の処理

    return TaskStatus.InProgress
  }

  // ---- Private ---- //
  private checkPrimitiveWorkerTask(objects: OwnedRoomObjects): void {
    if (this.roomName !== "W24S29") {
      return  // FixMe:
    }

    const primitiveWorkerTask = this.children.find(task => task instanceof PrimitiveWorkerTask) as PrimitiveWorkerTask | undefined
    if (primitiveWorkerTask == null) {
      return
    }

    if (objects.activeStructures.storage == null) { // TODO: 条件を詰める
      return
    }
    this.removeChildTask(primitiveWorkerTask)

    this.addChildTask(GeneralWorkerTask.create(this.roomName))
    objects.sources.forEach(source => {
      this.addChildTask(OwnedRoomHarvesterTask.create(this.roomName, source))
    })
  }
}
