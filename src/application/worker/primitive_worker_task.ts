import { ChildTask, Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { CreepTaskAssignTaskRequest, SpawnCreepTaskRequest, SpawnTaskRequestPriority } from "application/task_request"
import { TaskRequests } from "application/task_requests"
import { TaskState } from "application/task_state"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { HarvestEnergyApiWrapper } from "object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import type { CreepName } from "prototype/creep"
import { CreepRole } from "prototype/creep_role"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { createCreepBody } from "utility/creep_body"
import { RoomName } from "utility/room_name"
import { createWorkerTaskIdentifier } from "./worker_task_definition"

const creepCountForSource = 6

export interface PrimitiveWorkerTaskState extends TaskState {
  /** task type identifier */
  t: "PrimitiveWorkerTask"
}

export class PrimitiveWorkerTask extends Task<void, void> {
  public readonly taskType = "PrimitiveWorkerTask"
  public readonly identifier: TaskIdentifier
  public get children(): ChildTask<void>[] {
    return []
  }

  protected constructor(
    public readonly startTime: number,
    public readonly roomName: RoomName,
    protected paused: number | null,
  ) {
    super(startTime, roomName, paused)

    this.identifier = createWorkerTaskIdentifier(this.roomName)
  }

  public encode(): PrimitiveWorkerTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      r: this.roomName,
      p: this.paused,
    }
  }

  public static decode(state: PrimitiveWorkerTaskState): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(state.s, state.r, state.p)
  }

  public static create(roomName: RoomName): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(Game.time, roomName, null)
  }

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests<void>): TaskRequests<void> {
    const creepCount = roomResource.countCreeps(this.identifier)
    const minimumCreepCount = creepCountForSource * roomResource.sources.length

    if (creepCount < minimumCreepCount) {
      requestsFromChildren.spawnRequests.push(new SpawnCreepTaskRequest(
        this.identifier,
        SpawnTaskRequestPriority.Medium,
        this.createBody(roomResource.room.energyCapacityAvailable),
        [CreepRole.Worker, CreepRole.Mover],
        "", // FixMe:
      ))
    }

    const idleCreeps = roomResource.idleCreeps(this.identifier)
    idleCreeps.forEach(([creep, creepMemory]) => {
      const newTask = this.newTaskFor(creep, creepMemory.r.includes(CreepRole.Hauler), roomResource)
      if (newTask == null) {
        return
      }
      const taskRequest: CreepTaskAssignTaskRequest = {
        taskType: "normal",
        task: newTask,
      }

      requestsFromChildren.creepTaskAssignRequests.set(creep.name, taskRequest) // FixMe: ここでマージ問題が出てくるのでは
    })

    return requestsFromChildren
  }

  private createBody(energyCapacity: number): BodyPartConstant[] {
    return createCreepBody([], [WORK, CARRY, MOVE, MOVE], energyCapacity, 3)
  }

  public overrideCreepTask(creepName: CreepName, request1: CreepTaskAssignTaskRequest, request2: CreepTaskAssignTaskRequest): CreepTaskAssignTaskRequest {
    PrimitiveLogger.programError(`${this.identifier} overrideCreepTask() is not implemented yet (${request1.task})`)
    return request1
  }

  // TODO: haulerのタスク
  private newTaskFor(creep: Creep, isHauler: boolean, roomResource: OwnedRoomResource): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const source = roomResource.getSourceToAssign(creep.pos)
      if (source == null) {
        return null
      }
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
    }

    const structureToCharge = roomResource.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    const damagedStructure = roomResource.getRepairStructure()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
    }
    const constructionSite = roomResource.getConstructionSite()
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(roomResource.controller))

  }
}
