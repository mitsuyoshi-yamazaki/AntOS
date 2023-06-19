import { ProblemFinder } from "v5_problem/problem_finder"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "v5_task/general/general_creep_worker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { World } from "world_info/world_info"
import { CreepRole } from "prototype/creep_role"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { DropResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { RepairApiWrapper } from "v5_object_task/creep_task/api_wrapper/repair_api_wrapper"
import { bodyCost, CreepBody } from "utility/creep_body"
import { TempRenewApiWrapper } from "v5_object_task/creep_task/api_wrapper/temp_renew_api_wrapper"
import { RoomResources } from "room_resource/room_resources"
import { GameConstants } from "utility/constants"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { FleeFromSKLairTask } from "v5_object_task/creep_task/combined_task/flee_from_sk_lair_task"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import type { RoomName } from "shared/utility/room_name_types"
import { roomTypeOf } from "utility/room_coordinate"

const generalWorkerSpec = (() => {
  const bodyUnit = [CARRY, WORK, MOVE, MOVE]
  const unitCount = 6
  const body = Array(unitCount).fill(bodyUnit).flatMap(x => x)
  const maxEnergyCapacity = CreepBody.cost(body)

  return {
    bodyUnit,
    unitCount,
    body,
    maxEnergyCapacity,
  }
})()

function neighboursToObserve(roomName: RoomName): RoomName[] {
  const exits = Game.map.describeExits(roomName)
  if (exits == null) { // sim環境ではundefinedが返る
    return []
  }
  return Array.from(Object.values(exits)).filter(neighbourRoomName => {
    if (roomTypeOf(neighbourRoomName) !== "normal") {
      return false
    }
    return true
  })
}

type EnergySourceStructureType = StructureTerminal
  | StructureStorage
  | StructureFactory
  | StructureLink
  | StructureLab
  | StructureExtension
  | StructureSpawn
  | StructureTower
export const leftoverStructurePriority: StructureConstant[] = [ // 添字の大きい方が優先
  STRUCTURE_TERMINAL,
  STRUCTURE_STORAGE,
  STRUCTURE_FACTORY,
  STRUCTURE_LINK,
  STRUCTURE_LAB,
  STRUCTURE_EXTENSION,
  STRUCTURE_SPAWN,
  STRUCTURE_TOWER,
]

export interface UpgradeToRcl3TaskState extends GeneralCreepWorkerTaskState {
  /** parent room name */
  r: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  neighboursToObserve: RoomName[]
  requiredEnergy: number
}

/**
 * - RCLになりTowerとSpawnの建設が終わるまで
 *   - Tower, SpawnのConstruction Siteの設置はCreateConstructionSiteTaskが行っている
 */
export class UpgradeToRcl3Task extends GeneralCreepWorkerTask {
  public readonly taskIdentifier: TaskIdentifier

  private readonly codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
    private readonly neighboursToObserve: RoomName[],
    private readonly requiredEnergy: number,
  ) {
    super(startTime, children, parentRoomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)
  }

  public encode(): UpgradeToRcl3TaskState {
    return {
      t: "UpgradeToRcl3Task",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      neighboursToObserve: this.neighboursToObserve,
      requiredEnergy: this.requiredEnergy,
    }
  }

  public static decode(state: UpgradeToRcl3TaskState, children: Task[]): UpgradeToRcl3Task {
    return new UpgradeToRcl3Task(state.s, children, state.r, state.tr, state.w, state.neighboursToObserve, state.requiredEnergy)
  }

  public static create(parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], requiredEnergy: number): UpgradeToRcl3Task {
    return new UpgradeToRcl3Task(Game.time, [], parentRoomName, targetRoomName, waypoints, neighboursToObserve(targetRoomName), requiredEnergy)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const roomResource = RoomResources.getOwnedRoomResource(this.targetRoomName)
    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (targetRoomObjects != null) {
      if (targetRoomObjects.activeStructures.spawns.length > 0 && targetRoomObjects.activeStructures.storage != null && targetRoomObjects.activeStructures.storage.my === true && targetRoomObjects.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= this.requiredEnergy) {
        this.takeOverCreeps()
        targetRoomObjects.roomInfo.bootstrapping = false

        if (roomResource != null) {
          if (roomResource.roomInfo.config?.bootstrapUntilRcl5 === true) {
            roomResource.roomInfo.config.bootstrapUntilRcl5 = false
          }
        }
        return TaskStatus.Finished
      }
      targetRoomObjects.roomInfo.bootstrapping = true

      this.removeEmptyHostileStructures(targetRoomObjects.controller.room)
    }

    if (roomResource != null && roomResource.activeStructures.towers.length >= 2) {
      if (roomResource.roomInfo.config?.bootstrapUntilRcl5 === true) {
        roomResource.roomInfo.config.bootstrapUntilRcl5 = false
      }
    }

    super.runTask(objects, childTaskResults)

    const problemFinders: ProblemFinder[] = [
    ]

    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  public creepFileterRoles(): CreepRole[] | null {
    return null
  }

  public creepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest | null {
    if (shouldSpawnBootstrapCreeps(this.roomName, this.targetRoomName) !== true) {
      return null
    }

    const { body, creepCount } = this.creepBody(objects.controller.room.energyCapacityAvailable)

    return {
      necessaryRoles: [CreepRole.Worker, CreepRole.Mover, CreepRole.EnergyStore],
      taskIdentifier: this.taskIdentifier,
      numberOfCreeps: creepCount,
      codename: this.codename,
      initialTask: MoveToRoomTask.create(this.targetRoomName, this.waypoints),
      priority: CreepSpawnRequestPriority.Low,
      body,
    }
  }

  public newTaskFor(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0 && creep.room.roomType !== "source_keeper") {
        const creepRoomInfo = RoomResources.getRoomInfo(creep.room.name)
        if (creepRoomInfo != null && creepRoomInfo.neighbourRoomNames.includes(this.targetRoomName) === true) {
          const source = creep.room.find(FIND_SOURCES).sort((lhs, rhs) => {
            return lhs.v5TargetedBy.length - rhs.v5TargetedBy.length
          })[0]
          if (source != null) {
            return FleeFromSKLairTask.create(MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source)))
          }
        }
        return FleeFromSKLairTask.create(MoveToRoomTask.create(this.targetRoomName, this.waypoints))
      }
    }

    const task = this.getNewTaskFor(creep)
    if (task == null) {
      return null
    }
    return FleeFromAttackerTask.create(task)
  }

  private getNewTaskFor(creep: Creep): CreepTask | null {
    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (targetRoomObjects == null) {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
        const sources = creep.room.find(FIND_SOURCES)
        const source = sources[Game.time % sources.length]
        if (source != null) {
          return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
        }
        creep.say("no source")
        return null
      } else {
        const constructionSite = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES)
        if (constructionSite != null) {
          return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
        }

        return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
      }
    }

    const roomResources = RoomResources.getOwnedRoomResource(this.targetRoomName)
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      const droppedEnergy = this.getDroppedEnergy(creep.pos, targetRoomObjects)
      if (droppedEnergy != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(droppedEnergy))
      }

      const sourceAvailable = ((): boolean => {
        return targetRoomObjects.sources.some(source => {
          if (source.v5TargetedBy.length > 1) {
            return false
          }
          if (source.energy > 100) {
            return true
          }
          if (source.ticksToRegeneration < 10) {
            return true
          }
          return false
        })
      })()

      if (sourceAvailable !== true) {
        const energySource = this.getEnergySourceStructure(creep, targetRoomObjects)
        if (energySource != null) {
          return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(energySource, RESOURCE_ENERGY))
        }
      }

      const source = targetRoomObjects.getSource(creep.pos)
      if (source != null) {
        return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source), { reusePath: 3, ignoreSwamp: false })
      }

      if (this.neighboursToObserve.length > 0) {
        const removeRoomName = (roomName: RoomName): void => {
          const index = this.neighboursToObserve.indexOf(roomName)
          if (index < 0) {
            return
          }
          this.neighboursToObserve.splice(index, 1)
        }
        for (const neighbourRoomName of [...this.neighboursToObserve]) {
          removeRoomName(neighbourRoomName)
          const neighbourRoomInfo = RoomResources.getRoomInfo(neighbourRoomName)
          if (neighbourRoomInfo != null) {
            continue
          }
          return MoveToRoomTask.create(neighbourRoomName, [])
        }
      }
      if (roomResources == null) {
        return null
      }
      return this.getNeighbourHarvestTaskFor(creep, roomResources)
    }

    if (targetRoomObjects.controller.level < 2) {
      if (targetRoomObjects.controller.upgradeBlocked == null) {
        return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(targetRoomObjects.controller), { reusePath: 3, ignoreSwamp: false })
      }
    }

    const structureToCharge = targetRoomObjects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    const damagedStructure = targetRoomObjects.getRepairStructure()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
    }

    if (roomResources != null && (Game.time % 3) === 0) {
      const ramparts = [...roomResources.ramparts]
      ramparts.sort((lhs, rhs) => lhs.hits - rhs.hits)
      const rampart = ramparts[0]
      if (rampart != null && rampart.hits < 100000) {
        return MoveToTargetTask.create(RepairApiWrapper.create(rampart))
      }
    }

    if (creep.ticksToLive != null && creep.ticksToLive < 400) {
      const spawn = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } }) as StructureSpawn | null
      if (spawn != null && spawn.room.energyAvailable > 150) {
        const cost = bodyCost(creep.body.map(b => b.type))
        if (cost > spawn.room.energyCapacityAvailable) {
          return MoveToTargetTask.create(TempRenewApiWrapper.create(spawn))
        }
      }
    }

    // const constructionSite = targetRoomObjects.getConstructionSite()
    const constructionSite = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES)
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    if (targetRoomObjects.controller.upgradeBlocked == null) {
      return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(targetRoomObjects.controller), { reusePath: 3, ignoreSwamp: false })
    }

    if (roomResources != null) {
      const ramparts = [...roomResources.ramparts]
      ramparts.sort((lhs, rhs) => lhs.hits - rhs.hits)
      const rampart = ramparts[0]
      if (rampart != null && rampart.hits < rampart.hitsMax) {
        return MoveToTargetTask.create(RepairApiWrapper.create(rampart))
      }
    }
    return null
  }

  private getDroppedEnergy(position: RoomPosition, targetRoomObjects: OwnedRoomObjects): Resource | null {
    const droppedResources = targetRoomObjects.droppedResources.filter(resource => {
      if (resource.resourceType !== RESOURCE_ENERGY) {
        return false
      }
      if (resource.v5TargetedBy.length > 0) {
        return false
      }
      return true
    })
    if (droppedResources.length <= 0) {
      return null
    }
    return droppedResources.reduce((lhs, rhs) => {
      return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
    })
  }

  private getNeighbourHarvestTaskFor(creep: Creep, roomResources: OwnedRoomResource): CreepTask | null {
    const harvestableNeighbourRooms: RoomName[] = roomResources.roomInfo.neighbourRoomNames.flatMap(neighbourRoomName => {
      const neighbourRoomInfo = RoomResources.getRoomInfo(neighbourRoomName)
      if (neighbourRoomInfo == null) {
        return []
      }
      if (neighbourRoomInfo.roomType !== "normal" || roomTypeOf(neighbourRoomName) !== "normal") {
        return []
      }
      if (neighbourRoomInfo.owner != null) {
        return []
      }
      if (neighbourRoomInfo.numberOfSources <= 0) {
        return []
      }
      return neighbourRoomName
    })

    const neighbourSources: Source[] = []
    for (const harvestableNeighbourRoom of harvestableNeighbourRooms) {
      const room = Game.rooms[harvestableNeighbourRoom]
      if (room == null) {
        return MoveToRoomTask.create(harvestableNeighbourRoom, [])
      }
      neighbourSources.push(...room.find(FIND_SOURCES))
    }

    const targetSource = neighbourSources.sort((lhs, rhs) => {
      return lhs.v5TargetedBy.length - rhs.v5TargetedBy.length
    })[0]
    if (targetSource != null) {
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(targetSource))
    }
    creep.say("nothing")
    return null
  }

  private getEnergySourceStructure(creep: Creep, targetRoomObjects: OwnedRoomObjects): EnergySourceStructureType | Ruin | null {
    const targetRoom = targetRoomObjects.controller.room
    const targetRuin = targetRoom.find(FIND_RUINS)
      .filter(ruin => {
        if (ruin.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
          return false
        }
        return true
      })
      .sort((lhs, rhs) => {
        return creep.pos.getRangeTo(lhs) - creep.pos.getRangeTo(rhs)
      })[0]
    if (targetRuin != null) {
      return targetRuin
    }

    const maxDistance = GameConstants.room.edgePosition.max
    const hostileStructures: EnergySourceStructureType[] = targetRoom.find(FIND_HOSTILE_STRUCTURES)
      .flatMap(structure => {
        if (structure instanceof StructureTower) {
          return structure
        }
        if (structure instanceof StructureSpawn) {
          return structure
        }
        if (structure instanceof StructureExtension) {
          return structure
        }
        if (structure instanceof StructureLink) {
          return structure
        }
        if (structure instanceof StructureLab) {
          return structure
        }
        if (structure instanceof StructureFactory) {
          return structure
        }
        if (structure instanceof StructureStorage) {
          return structure
        }
        if (structure instanceof StructureTerminal) {
          return structure
        }
        return []
      })
      .filter(structure => structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0)
    const scoredHostileStructures: [EnergySourceStructureType, number][] = hostileStructures.map(structure => {
      const index = leftoverStructurePriority.indexOf(structure.structureType)
      const range = creep.pos.getRangeTo(structure.pos)
      return [structure, (index * maxDistance) + (maxDistance - range)]
    })
    scoredHostileStructures.sort((lhs, rhs) => {
      return rhs[1] - lhs[1]
    })

    const target = scoredHostileStructures[0] ?? null
    if (target != null) {
      return target[0]
    }
    return null
  }

  // ---- Creep Body ---- //
  private creepBody(energyCapacity: number): { body: BodyPartConstant[], creepCount: number } {
    if (energyCapacity <= generalWorkerSpec.maxEnergyCapacity) {
      return {
        body: [...generalWorkerSpec.body],
        creepCount: 6,
      }
    }

    return {
      body: CreepBody.create([], generalWorkerSpec.bodyUnit, energyCapacity, generalWorkerSpec.unitCount + 4),
      creepCount: 4,
    }
  }

  // ---- Take Over Creeps ---- //
  private takeOverCreeps(): void {
    World.resourcePools.takeOverCreeps(this.parentRoomName, this.taskIdentifier, null, this.targetRoomName)
  }

  // ---- Energy source structures ---- //
  private removeEmptyHostileStructures(room: Room): void {
    room.find(FIND_HOSTILE_STRUCTURES)
      .forEach(structure => {
        const store = (structure as {store?: StoreDefinition}).store
        if (store != null) {
          if (store.getUsedCapacity(RESOURCE_ENERGY) > 0 || (store.getUsedCapacity() || 0) > 0) {
            return
          }
        }
        structure.destroy()
      })
  }
}

function shouldSpawnBootstrapCreeps(roomName: RoomName, targetRoomName: RoomName): boolean {
  const targetRoomInfo = RoomResources.getRoomInfo(targetRoomName)
  if (targetRoomInfo == null) {
    return true
  }
  if (targetRoomInfo.roomType !== "normal") {
    return true
  }
  if (targetRoomInfo.owner == null) {
    return true
  }
  if (targetRoomInfo.owner.ownerType === "claim" && targetRoomInfo.owner.username !== Game.user.name) {
    return false
  }
  const availableEnergy = ((): number => {
    const roomResource = RoomResources.getOwnedRoomResource(roomName)
    if (roomResource == null) {
      PrimitiveLogger.programError(`Bootstrap parent room ${roomLink(roomName)} is not owned`)
      return 0
    }
    const storage = roomResource.activeStructures.storage
    const terminal = roomResource.activeStructures.terminal
    if (storage == null && terminal == null) {
      PrimitiveLogger.programError(`Bootstrap parent room ${roomLink(roomName)} has no storage and terminal`)
      return 0
    }
    return (storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) + (terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
  })()

  if (availableEnergy < 40000) {
    return false
  }
  return true
}
