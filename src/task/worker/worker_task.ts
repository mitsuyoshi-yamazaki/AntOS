import { RoomName } from "utility/room_name"
import { OwnedRoomHarvesterTask } from "task/harvester/owned_room_harvester_task"
import { EnergySourceTask } from "task/hauler/owned_room_energy_source_task"
import { OwnedRoomHaulerTask } from "task/hauler/owned_room_hauler_task"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralWorkerTask } from "./general_worker_task"
import { PrimitiveWorkerTask } from "./primitive_worker_task"
import { TaskState } from "task/task_state"
import { UpgraderTask } from "task/upgrader/upgrader_task"

export interface WorkerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

/**
 * - concrete worker taskを実行する
 * - PrimitiveWorker系からの更新にはGame.rooms["W27S26"].find(FIND_MY_CREEPS).forEach(c => c.memory.r.push("energy_store"))が必要
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

  public static decode(state: WorkerTaskState, children: Task[]): WorkerTask {
    return new WorkerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): WorkerTask {
    const children: Task[] = [
      PrimitiveWorkerTask.create(roomName),
    ]
    return new WorkerTask(Game.time, children, roomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    this.checkPrimitiveWorkerTask(objects)

    // TODO: creepがいなくなった場合の処理

    if (this.roomName === "W24S29" && this.children.some(task => task instanceof UpgraderTask) !== true) {  // FixMe: 一時コード
      this.addChildTask(UpgraderTask.create(this.roomName))
    }
    // const upgraderTask = this.children.find(task => task instanceof UpgraderTask)
    // if (upgraderTask != null) {
    //   this.removeChildTask(upgraderTask)
    // }

    return TaskStatus.InProgress
  }

  // ---- Private ---- //
  private checkPrimitiveWorkerTask(objects: OwnedRoomObjects): void {
    const primitiveWorkerTask = this.children.find(task => task instanceof PrimitiveWorkerTask) as PrimitiveWorkerTask | undefined
    if (primitiveWorkerTask == null) {
      return
    }

    if (objects.activeStructures.storage == null) { // TODO: 条件を詰める
      return
    }
    this.removeChildTask(primitiveWorkerTask)

    this.addChildTask(GeneralWorkerTask.create(this.roomName))
    const energySources: EnergySourceTask[] = objects.sources.map(source => OwnedRoomHarvesterTask.create(this.roomName, source))
    this.addChildTask(OwnedRoomHaulerTask.create(this.roomName, energySources))
  }
}
