import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveHarvestEnergyTask } from "object_task/creep_task/combined_task/move_harvest_energy_task"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { PrimitiveWorkerTask } from "./primitive_worker_task"
import { GeneralWorkerTask } from "./general_worker_task"
import { HarvesterTask } from "task/harvester/harvester_task"

const creepCountForSource = 6

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
    const primitiveWorkerTask = this.children.find(task => task instanceof PrimitiveWorkerTask) as PrimitiveWorkerTask | undefined
    if (primitiveWorkerTask == null) {
      return
    }

    // TODO:
    // if (objects.activeStructures.storage == null) { // TODO: 条件を詰める
    //   return
    // }
    // this.removeChildTask(primitiveWorkerTask)

    // this.addChildTask(GeneralWorkerTask.create(this.roomName))
    // objects.sources.forEach(source => {
    //   this.addChildTask(HarvesterTask.create(this.roomName, source.id))
    // })
  }
}
