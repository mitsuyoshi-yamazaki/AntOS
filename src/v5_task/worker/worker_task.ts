import { RoomName } from "utility/room_name"
import { OwnedRoomHarvesterTask } from "v5_task/harvester/owned_room_harvester_task"
import { EnergySourceTask } from "v5_task/hauler/owned_room_energy_source_task"
import { OwnedRoomHaulerTask } from "v5_task/hauler/owned_room_hauler_task"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralWorkerTask } from "./general_worker_task"
import { PrimitiveWorkerTask } from "./primitive_worker_task"
import { TaskState } from "v5_task/task_state"
import { UpgraderTask } from "v5_task/upgrader/upgrader_task"
import { SpecializedWorkerTask } from "./specialized_worker_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

interface WorkerTaskStateUnknown {
  workerTaskStateType: "unknown"
}
interface WorkerTaskStatePrimitive {
  workerTaskStateType: "primitive"
  task: PrimitiveWorkerTask
}
interface WorkerTaskStateGeneral {
  workerTaskStateType: "general"
  task: GeneralWorkerTask
}
interface WorkerTaskStateSpecialized {
  workerTaskStateType: "specialized"
  task: SpecializedWorkerTask
}
type WorkerTaskStatus = WorkerTaskStateUnknown | WorkerTaskStatePrimitive | WorkerTaskStateGeneral | WorkerTaskStateSpecialized

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
    const status = this.status()
    switch (status.workerTaskStateType) {
    case "primitive":
      this.checkPrimitiveWorkerTask(status.task, objects)
      break
    case "general":
      this.checkGeneralWorkerTask(status.task, objects)
      break
    case "specialized":
      break
    case "unknown":
      PrimitiveLogger.fatal(`No concrete worker task in ${this.taskIdentifier} at ${roomLink(this.roomName)}`)
      break
    }

    // TODO: creepがいなくなった場合の処理

    // if (this.roomName === "W27S26" && this.children.some(task => task instanceof UpgraderTask) !== true) {  // FixMe: 一時コード
    //   this.addChildTask(UpgraderTask.create(this.roomName))
    // }
    // const upgraderTask = this.children.find(task => task instanceof UpgraderTask)
    // if (this.roomName === "W27S26" && upgraderTask != null) {
    //   this.removeChildTask(upgraderTask)
    // }

    return TaskStatus.InProgress
  }

  // ---- Status ---- //
  private status(): WorkerTaskStatus {
    const primitiveWorkerTask = this.children.find(task => task instanceof PrimitiveWorkerTask) as PrimitiveWorkerTask | undefined
    if (primitiveWorkerTask != null) {
      return {
        workerTaskStateType: "primitive",
        task: primitiveWorkerTask,
      }
    }

    const generalWorkerTask = this.children.find(task => task instanceof GeneralWorkerTask) as GeneralWorkerTask | undefined
    if (generalWorkerTask != null) {
      return {
        workerTaskStateType: "general",
        task: generalWorkerTask,
      }
    }

    const specializedWorkerTask = this.children.find(task => task instanceof SpecializedWorkerTask) as SpecializedWorkerTask | undefined
    if (specializedWorkerTask != null) {
      return {
        workerTaskStateType: "specialized",
        task: specializedWorkerTask,
      }
    }

    return {
      workerTaskStateType: "unknown",
    }
  }

  // ---- Private ---- //
  private checkPrimitiveWorkerTask(primitiveWorkerTask: PrimitiveWorkerTask, objects: OwnedRoomObjects): void {
    if (objects.activeStructures.storage == null || objects.activeStructures.storage.my != null) { // TODO: 条件を詰める
      return
    }
    this.removeChildTask(primitiveWorkerTask)

    this.addChildTask(GeneralWorkerTask.create(this.roomName))
    const energySources: EnergySourceTask[] = objects.sources.map(source => OwnedRoomHarvesterTask.create(this.roomName, source))
    this.addChildTask(OwnedRoomHaulerTask.create(this.roomName, energySources))
  }

  private checkGeneralWorkerTask(generalWorkerTask: GeneralWorkerTask, objects: OwnedRoomObjects): void {
    if (objects.activeStructures.storage == null || objects.activeStructures.storage.my != null) {
      return
    }
    if (objects.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000) {  // TODO: 条件を詰める
      if (objects.controller.level <= 5) {
        return
      }
    }
    this.removeChildTask(generalWorkerTask)

    this.addChildTask(SpecializedWorkerTask.create(this.roomName))
    this.addChildTask(UpgraderTask.create(this.roomName))
  }
}
