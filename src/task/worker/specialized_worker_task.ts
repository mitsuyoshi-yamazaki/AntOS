import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole } from "prototype/creep_role"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { generateCodename } from "utility/unique_id"
import { GetEnergyApiWrapper } from "object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { HarvestEnergyApiWrapper } from "object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { TaskState } from "task/task_state"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest } from "task/general/general_creep_worker_task"
import { createCreepBody } from "utility/creep_body"

const numberOfCreeps = 4

export interface SpecializedWorkerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

/**
 * - charge, buildする
 */
export class SpecializedWorkerTask extends GeneralCreepWorkerTask {
  public readonly taskIdentifier: TaskIdentifier

  private readonly codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children, roomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)
  }

  public encode(): SpecializedWorkerTaskState {
    return {
      t: "SpecializedWorkerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: SpecializedWorkerTaskState, children: Task[]): SpecializedWorkerTask {
    return new SpecializedWorkerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): SpecializedWorkerTask {
    return new SpecializedWorkerTask(Game.time, [], roomName)
  }

  public creepFileterRoles(): CreepRole[] | null {
    return null
  }

  public creepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest | null {
    if (objects.constructionSites.length > 0 || objects.damagedStructures.length > 0) {
      // this.removeBuilderCreepRequest() // CreepInsufficiencyProblemSolverは毎tick Finishするため不要
      return this.builderCreepRequest(objects)
    } else {
      // this.removeHaulerCreepRequest()
      return this.haulerCreepRequest(objects)
    }
  }

  public newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      const energyStore = objects.getEnergyStore(creep.pos)
      if (energyStore != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(energyStore))
      }

      if (creep.roles.includes(CreepRole.Worker) === true) {
        const source = objects.getSource(creep.pos)
        if (source != null) {
          return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
        }
      }

      creep.say("no task")
      return null
    }

    if (creep.roles.includes(CreepRole.Worker) === true) {
      const damagedStructure = objects.getRepairStructure()
      if (damagedStructure != null) {
        return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
      }

      const constructionSite = objects.getConstructionSite()
      if (constructionSite != null) {
        return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
      }

      const structureToCharge = objects.getStructureToCharge(creep.pos)
      if (structureToCharge != null) {
        return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
      }

      return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller))

    } else {
      const structureToCharge = objects.getStructureToCharge(creep.pos)
      if (structureToCharge != null) {
        return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
      }

      creep.say("no task")
      return null
    }
  }

  // ---- Creep Request ---- //
  // private removeHaulerCreepRequest(): void {
  //   const task = this.children.find(task => {
  //     if (!(task instanceof CreepInsufficiencyProblemSolver)) {
  //       return false
  //     }
  //     return task.necessaryRoles.includes(CreepRole.Worker) !== true
  //   })
  //   if (task != null) {
  //     this.removeChildTask(task)
  //   }
  // }

  // private removeBuilderCreepRequest(): void {
  //   const task = this.children.find(task => {
  //     if (!(task instanceof CreepInsufficiencyProblemSolver)) {
  //       return false
  //     }
  //     return task.necessaryRoles.includes(CreepRole.Worker)
  //   })
  //   if (task != null) {
  //     this.removeChildTask(task)
  //   }
  // }

  private builderCreepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest {
    return {
      necessaryRoles: [CreepRole.Worker, CreepRole.Hauler, CreepRole.Mover],
      taskIdentifier: null,
      numberOfCreeps,
      codename: this.codename,
      initialTask: null,
      priority: CreepSpawnRequestPriority.Medium,
      body: this.builderBody(objects)
    }
  }

  private haulerCreepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest {
    return {
      necessaryRoles: [CreepRole.Hauler, CreepRole.Mover],
      taskIdentifier: null,
      numberOfCreeps,
      codename: this.codename,
      initialTask: null,
      priority: CreepSpawnRequestPriority.Medium,
      body: this.haulerBody(objects)
    }
  }

  private builderBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    return createCreepBody([], [CARRY, WORK, MOVE], objects.controller.room.energyCapacityAvailable, 5)
  }

  private haulerBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    return createCreepBody([], [CARRY, CARRY, MOVE], objects.controller.room.energyCapacityAvailable, 5)
  }
}
