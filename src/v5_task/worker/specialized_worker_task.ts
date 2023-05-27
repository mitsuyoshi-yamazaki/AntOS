import type { RoomName } from "shared/utility/room_name_types"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
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
import { RoomResources } from "room_resource/room_resources"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { decodeRoomPosition } from "prototype/room_position"
import { SwapNearbyCreepPositionTask } from "v5_object_task/creep_task/meta_task/swap_nearby_creep_position_task"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"
import { Environment } from "utility/environment"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"

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
  private saying = 0
  private shouldEvacuate = false

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
    const creepCount = World.resourcePools.countCreeps(this.roomName, null, () => true)
    const energyAmount = (objects.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      + (objects.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
    const lackOfEnergy = energyAmount < 10000

    const wallTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
    const needBuild = objects.constructionSites.some(site => (wallTypes.includes(site.structureType) !== true))

    const numberOfCreeps = ((): number => {
      const resources = RoomResources.getOwnedRoomResource(this.roomName)
      if (resources == null) {
        return 3
      }
      if (resources.roomInfo.config?.specializedWorkerCount != null) {
        return resources.roomInfo.config?.specializedWorkerCount
      }
      if (resources.roomInfo.roomPlan == null) {
        return 3
      }
      if (resources.controller.level >= 6) {
        if (needBuild === true) {
          return 4
        }
        return 3
      }
      const center = resources.roomInfo.roomPlan.centerPosition
      const centerPosition = decodeRoomPosition(center, this.roomName)
      const controllerRange = resources.controller.pos.getRangeTo(centerPosition)
      const requiredCount = Math.max(Math.floor(controllerRange / 4) + 1, 3)
      if (resources.controller.level > 5) {
        return requiredCount <= 3 ? 3 : 4
      }
      if (lackOfEnergy === true) {
        return Math.min(requiredCount, 4)
      }
      return requiredCount
    })()

    if (creepCount < 2) {
      const body = ((): BodyPartConstant[] => {
        if (lackOfEnergy !== true) {
          const haulerBody = this.haulerBody(objects)
          if (objects.controller.room.energyAvailable < CreepBody.cost(haulerBody)) {
            return [CARRY, CARRY, MOVE, CARRY, CARRY, MOVE]
          }
          return haulerBody
        }
        const builderBody = this.builderBody(objects)
        if (objects.controller.room.energyAvailable < CreepBody.cost(builderBody)) {
          return [CARRY, WORK, MOVE]
        }
        return builderBody
      })()
      const roles: CreepRole[] = [CreepRole.Hauler, CreepRole.Mover]
      if (body.includes(WORK) === true) {
        roles.push(CreepRole.Worker)
      }
      return {
        necessaryRoles: roles,
        taskIdentifier: null,
        numberOfCreeps,
        codename: this.codename,
        initialTask: null,
        priority: CreepSpawnRequestPriority.High,
        body,
      }
    }

    const needBuilder = ((): boolean => {
      // energyが不足する状況でworkerがupgradeする悪循環を無くすため
      // if (lackOfEnergy === true) {
      //   return true
      // }
      const needRepair = objects.damagedStructures.length > 0
      if (needRepair !== true && needBuild !== true) {
        return false
      }
      const builderCount = World.resourcePools.countCreeps(this.roomName, null, creep => (creep.roles.includes(CreepRole.Worker) === true))
      if (builderCount < 2) {
        return true
      }
      return false
    })()
    if (needBuilder === true) {
      return this.builderCreepRequest(objects, numberOfCreeps)
    } else {
      return this.haulerCreepRequest(objects, numberOfCreeps)
    }
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      this.shouldEvacuate = false
    } else {
      if (roomResource.nukes.some(nuke => nuke.timeToLand < 40) === true) {
        this.shouldEvacuate = true
      } else {
        this.shouldEvacuate = false
      }
    }

    return super.runTask(objects, childTaskResults)
  }

  public newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const task = this.taskFor(creep, objects)
    if (task == null) {
      return null
    }
    return FleeFromAttackerTask.create(task, 4, {failOnFlee: true})
  }

  private evacuateTask(creep: Creep): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      creep.drop(RESOURCE_ENERGY)
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return null
    }
    if (creep.room.name !== this.roomName) {
      try {
        const roomCenter = new RoomPosition(25, 25, creep.room.name)
        const range = 20
        if (creep.pos.getRangeTo(roomCenter) <= range) {
          return null
        }
        return MoveToTask.create(roomCenter, range)

      } catch (error) {
        PrimitiveLogger.programError(`${this.constructor.name} ${this.taskIdentifier} ${error}`)
      }
    }

    const evacuateDestination = roomResource.roomInfoAccessor.evacuateDestination()
    return MoveToRoomTask.create(evacuateDestination, [])
  }

  private taskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    if (this.shouldEvacuate === true && (creep.ticksToLive != null && creep.ticksToLive > 40)) {
      return this.evacuateTask(creep)
    }

    const energyAmount = creep.store.getUsedCapacity(RESOURCE_ENERGY)
    if (energyAmount <= 0) {
      if (creep.store.getFreeCapacity() > 0) {
        const collectDroppedResourceTask = this.collectDroppedResourceTask(creep, objects)
        if (collectDroppedResourceTask != null) {
          return collectDroppedResourceTask
        }
      }

      const storedResourceType = (Array.from(Object.keys(creep.store)) as ResourceConstant[])[0]
      if (storedResourceType != null) {
        const transferTarget = ((): StructureTerminal | StructureStorage | null => {
          if (objects.activeStructures.terminal != null && objects.activeStructures.terminal.store.getFreeCapacity() > 0) {
            return objects.activeStructures.terminal
          }
          return objects.activeStructures.storage
        })()
        if (transferTarget != null) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(transferTarget, storedResourceType))
        }
      }

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
        creep.say("no task1")
      }
      if (objects.activeStructures.storage != null && creep.pos.getRangeTo(objects.activeStructures.storage.pos) < 10) {
        return SwapNearbyCreepPositionTask.create({ onRoadOnly: true })
      }
      return null
    }

    if (creep.roles.includes(CreepRole.Worker) === true) {
      const skipCharging = (energyAmount > (creep.store.getCapacity() * 0.7)) && (Game.time % 2 === 0)
      if (skipCharging !== true) {
        const structureToCharge = objects.getStructureToCharge(creep.pos)
        if (structureToCharge != null) {
          return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
        }
      }

      const damagedStructure = objects.getRepairStructure()
      if (damagedStructure != null) {
        return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
      }

      const constructionSite = objects.getConstructionSite(creep.pos)
      if (constructionSite != null && objects.hostiles.creeps.length <= 0) {
        return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
      }

      if (skipCharging === true) {
        const structureToCharge = objects.getStructureToCharge(creep.pos)
        if (structureToCharge != null) {
          return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
        }
      }

      if (objects.controller.level < 8) {
        return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller))  // UpgraderがいるとUpgradeできないためタスクが成功も失敗もしないままとなる
      }

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
    }

    if (creep.store.getFreeCapacity() > 0) {
      const collectDroppedResourceTask = this.collectDroppedResourceTask(creep, objects)
      if (collectDroppedResourceTask != null) {
        return collectDroppedResourceTask
      }
    }

    if (this.saying !== Game.time) {
      this.saying = Game.time
      creep.say("no task2")
    }
    if (objects.activeStructures.storage != null && creep.pos.getRangeTo(objects.activeStructures.storage.pos) < 10) {
      return SwapNearbyCreepPositionTask.create({ onRoadOnly: true })
    }
    return null
  }

  private collectDroppedResourceTask(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const hasResource = creep.store.getUsedCapacity() > 0
    const resourcefulTombstones = ((): Tombstone[] => {
      if (objects.hostiles.creeps.length > 0) {
        return []
      }
      return objects.tombStones.filter(tomb => {
        const amount = tomb.store.getUsedCapacity()
        if (amount <= 0) {
          return false
        }
        if (this.roomName === "W47S2" && Environment.world === "persistent world" && Environment.shard === "shard2") { // FixMe:
          if (tomb.pos.x <= 1) {
            return false
          }
        }
        if (hasResource !== true) {
          return true
        }
        if (amount !== tomb.store.getUsedCapacity(RESOURCE_ENERGY)) {
          return true
        }
        return false
      })
    })()
    const resourcefulTombstone = creep.pos.findClosestByRange(resourcefulTombstones)
    if (resourcefulTombstone != null) {
      const resourceTypes = Object.keys(resourcefulTombstone.store) as ResourceConstant[]
      const mineral = resourceTypes.filter(resourceType => resourceType !== RESOURCE_ENERGY)[0]

      if (mineral != null) {
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(resourcefulTombstone, mineral))
      }
      if (resourceTypes.includes(RESOURCE_ENERGY) === true) {
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(resourcefulTombstone, RESOURCE_ENERGY))
      }
    }

    const droppedResource = ((): Resource | null => {
      if (objects.hostiles.creeps.length > 0) {
        return null
      }
      if (hasResource === true) {
        return null
      }
      return objects.droppedResources.filter(resource => {
        if (this.roomName === "W47S2" && Environment.world === "persistent world" && Environment.shard === "shard2") { // FixMe:
          if (resource.pos.x <= 1) {
            return false
          }
        }
        if (this.roomName === "W48N46" && Environment.world === "persistent world" && Environment.shard === "shard3") { // FixMe:
          if (resource.resourceType === RESOURCE_KEANIUM) {
            return false
          }
        }
        if (resource.resourceType !== RESOURCE_ENERGY) {
          return true
        }
        return resource.amount > 200
      })[0] ?? null
    })()
    if (droppedResource != null) {
      return MoveToTargetTask.create(PickupApiWrapper.create(droppedResource))
    }

    return null
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

  private builderCreepRequest(objects: OwnedRoomObjects, numberOfCreeps: number): GeneralCreepWorkerTaskCreepRequest {
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

  private haulerCreepRequest(objects: OwnedRoomObjects, numberOfCreeps: number): GeneralCreepWorkerTaskCreepRequest {
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
    const maxUnitCount = ((): number => {
      if (objects.controller.level >= 6) {
        return 10
      }
      return 7
    })()
    return createCreepBody([], [CARRY, WORK, MOVE], objects.controller.room.energyCapacityAvailable, maxUnitCount)
  }

  private haulerBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    const maxUnitCount = ((): number => {
      if (objects.controller.level >= 6) {
        return 6
      }
      return 5
    })()
    return createCreepBody([], [CARRY, CARRY, MOVE], objects.controller.room.energyCapacityAvailable, maxUnitCount)
  }
}
