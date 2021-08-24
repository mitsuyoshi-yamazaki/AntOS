import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole } from "prototype/creep_role"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "v5_object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { generateCodename } from "utility/unique_id"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { TaskState } from "v5_task/task_state"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest } from "v5_task/general/general_creep_worker_task"
import { bodyCost, createCreepBody, CreepBody } from "utility/creep_body"
import { TempRenewApiWrapper } from "v5_object_task/creep_task/api_wrapper/temp_renew_api_wrapper"
import { World } from "world_info/world_info"
import { RandomMoveTask } from "v5_object_task/creep_task/meta_task/random_move_task"

let randomSeed = 0

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
  private readonly numberOfCreeps: number
  private saying = 0

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children, roomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)

    const numberOfCreeps: { [roomName: string]: number } = {
      "W6S29": 4,

      // shard3
      "W51S29": 4,
    }
    this.numberOfCreeps = numberOfCreeps[this.roomName] ?? 3
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
    const creepCount = World.resourcePools.countCreeps(this.roomName, null, () => true)
    if (creepCount < 2) {
      const body = ((): BodyPartConstant[] => {
        const haulerBody = this.haulerBody(objects)
        if (objects.controller.room.energyAvailable < CreepBody.cost(haulerBody)) {
          return [CARRY, CARRY, MOVE, CARRY, CARRY, MOVE]
        }
        return haulerBody
      })()
      return {
        necessaryRoles: [CreepRole.Hauler, CreepRole.Mover],
        taskIdentifier: null,
        numberOfCreeps: this.numberOfCreeps,
        codename: this.codename,
        initialTask: null,
        priority: CreepSpawnRequestPriority.High,
        body,
      }
    }

    const haulerCount = World.resourcePools.countCreeps(this.roomName, null, creep => (creep.roles.includes(CreepRole.Worker) !== true))
    if (haulerCount <= 0) {
      return this.haulerCreepRequest(objects)
    }
    const wallTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
    if (objects.constructionSites.some(site => (wallTypes.includes(site.structureType) !== true)) || objects.damagedStructures.length > 0) {
      // this.removeBuilderCreepRequest() // CreepInsufficiencyProblemSolverは毎tick Finishするため不要
      return this.builderCreepRequest(objects)
    } else {
      // this.removeHaulerCreepRequest()
      return this.haulerCreepRequest(objects)
    }
  }

  public newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      // OwnedRoomHaulerTask が行う
      // const droppedEnergy = objects.droppedResources.find(resource => resource.resourceType === RESOURCE_ENERGY)
      // if (droppedEnergy != null) {
      //   return MoveToTargetTask.create(GetEnergyApiWrapper.create(droppedEnergy))
      // }

      if (creep.ticksToLive != null && creep.ticksToLive < 400) {
        const spawn = objects.activeStructures.spawns[0]
        const room = objects.controller.room
        if (spawn != null && room.energyAvailable > 150) {
          const cost = bodyCost(creep.body.map(b => b.type))
          if (cost > room.energyCapacityAvailable) {
            return MoveToTargetTask.create(TempRenewApiWrapper.create(spawn))
          }
        }
      }

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

      if (this.saying !== Game.time) {
        this.saying = Game.time
        creep.say("no task")
      }
      if (objects.activeStructures.spawns[0] != null && creep.pos.getRangeTo(objects.activeStructures.spawns[0].pos) < 5) {
        randomSeed += 1
        if ((Game.time + this.startTime + randomSeed) % 4 === 0) {
          return RandomMoveTask.create()
        }
      }
      return null
    }

    if (creep.roles.includes(CreepRole.Worker) === true) {
      const structureToCharge = objects.getStructureToCharge(creep.pos)
      if (structureToCharge != null) {
        return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
      }

      const damagedStructure = objects.getRepairStructure()
      if (damagedStructure != null) {
        return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
      }

      const constructionSite = objects.getConstructionSite(creep.pos)
      if (constructionSite != null) {
        return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
      }

      return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller))

    } else {
      const structureToCharge = objects.getStructureToCharge(creep.pos)
      if (structureToCharge != null) {
        return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
      }

      const roomInfo = Memory.v6RoomInfo[objects.controller.room.name]
      if (roomInfo != null && roomInfo.roomType === "owned") {
        if (roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] != null) {
          const storage = objects.activeStructures.storage
          if (storage != null && storage.store.getUsedCapacity(RESOURCE_ENERGY) < 300000) {
            return MoveToTargetTask.create(TransferEnergyApiWrapper.create(storage))
          }
        }
      }
      if (this.saying !== Game.time) {
        this.saying = Game.time
        creep.say("no task")
      }
      if (objects.activeStructures.spawns[0] != null && creep.pos.getRangeTo(objects.activeStructures.spawns[0].pos) < 5) {
        randomSeed += 1
        if ((Game.time + this.startTime + randomSeed) % 4 === 0) {
          return RandomMoveTask.create()
        }
      }
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
      numberOfCreeps: this.numberOfCreeps,
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
      numberOfCreeps: this.numberOfCreeps,
      codename: this.codename,
      initialTask: null,
      priority: CreepSpawnRequestPriority.Medium,
      body: this.haulerBody(objects)
    }
  }

  private builderBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    return createCreepBody([], [CARRY, WORK, MOVE], objects.controller.room.energyCapacityAvailable, 7)
  }

  private haulerBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    return createCreepBody([], [CARRY, CARRY, MOVE], objects.controller.room.energyCapacityAvailable, 5)
  }
}
