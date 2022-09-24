import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredResourceType, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { ProcessDecoder } from "process/process_decoder"
import { World } from "world_info/world_info"
import { RoomResources } from "room_resource/room_resources"
import { processLog } from "os/infrastructure/logger"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepBody } from "utility/creep_body"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { GameMap } from "game/game_map"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { GameConstants } from "utility/constants"
import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { WithdrawApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_api_wrapper"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { OperatingSystem } from "os/os"
import { OwnedRoomProcess } from "process/owned_room_process"

ProcessDecoder.register("HarvestCommodityProcess", state => {
  return HarvestCommodityProcess.decode(state as HarvestCommodityProcessState)
})

const maxCooldown = 50
const tooLongCooldownReason = "too long cooldown"

type DepositInfo = {
  readonly roomName: RoomName
  readonly depositId: Id<Deposit>
  readonly commodityType: DepositConstant
  readonly neighbourCellCount: number
  currentCooldown: number
}

type CreepSpec = {
  readonly harvesterCount: number
  readonly haulerCount: number
}

export interface HarvestCommodityProcessState extends ProcessState {
  readonly parentRoomName: RoomName
  readonly depositInfo: DepositInfo
  readonly creepSpec: CreepSpec
  readonly suspendReasons: string[]
  readonly storageRoomName: RoomName | null
}

export class HarvestCommodityProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.parentRoomName
  }

  public readonly identifier: string
  private readonly codename: string

  private readonly harvesterRoles: CreepRole[] = [CreepRole.Harvester]
  private readonly haulerRoles: CreepRole[] = [CreepRole.Hauler]

  private droppedResources: (Tombstone | Resource)[] | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly depositInfo: DepositInfo,
    private readonly creepSpec: CreepSpec,
    private suspendReasons: string[],
    private storageRoomName: RoomName | null,
  ) {
    this.identifier = ((): string => {
      if (this.processId === 287027000) {
        return "HarvestCommodityProcess_W19S19"  // TODO: 消す
      }
      return `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.depositInfo.roomName}`
    })()

    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): HarvestCommodityProcessState {
    return {
      t: "HarvestCommodityProcess",
      l: this.launchTime,
      i: this.processId,
      parentRoomName: this.parentRoomName,
      depositInfo: this.depositInfo,
      creepSpec: this.creepSpec,
      suspendReasons: this.suspendReasons,
      storageRoomName: this.storageRoomName
    }
  }

  public static decode(state: HarvestCommodityProcessState): HarvestCommodityProcess {
    return new HarvestCommodityProcess(state.l, state.i, state.parentRoomName, state.depositInfo, state.creepSpec, state.suspendReasons, state.storageRoomName)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, depositInfo: DepositInfo, creepSpec: CreepSpec): HarvestCommodityProcess {
    return new HarvestCommodityProcess(Game.time, processId, parentRoomName, depositInfo, creepSpec, [], null)
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.taskIdentifier, () => true)
    const storageRoomDescription = this.storageRoomName == null ? "" : `-&gt ${roomLink(this.storageRoomName)}`
    const descriptions: string[] = [
      `${roomLink(this.parentRoomName)} -&gt ${coloredResourceType(this.depositInfo.commodityType)} in ${roomLink(this.depositInfo.roomName)}${storageRoomDescription}`,
      `${creepCount} cr`,
    ]
    const suspendReasons = [...this.suspendReasons]
    const roomResources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResources != null && this.hasEnoughEnergy(roomResources) !== true) {
      suspendReasons.push("lack of energy")
    }

    if (this.suspendReasons.length > 0) {
      descriptions.push(`Not spawning due to: ${suspendReasons.join(", ")}`)
    }
    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "stop", "resume", "set_storage_room"]
    const components = message.split(" ")
    const command = components.shift()
    const listArguments = new ListArguments(components)

    switch (command) {
    case "help":
      return `Available commands are: ${commandList.join(", ")}`

    case "stop":
      this.addSuspendReason("manual stop")
      return "stopped"

    case "resume": {
      const oldValue = [...this.suspendReasons]
      this.suspendReasons = []
      return `spawn resumed (stop reasons: ${oldValue.join(", ")})`
    }

    case "set_storage_room": {
      try {
        const roomName = listArguments.roomName(0, "storage room name").parse()
        if (RoomResources.getOwnedRoomResource(roomName) == null) {
          throw `${roomLink(roomName)} is not mine`
        }
        this.setStorageRoomName(roomName)
        return `storage room ${roomLink(roomName)} set`
      } catch (error) {
        return `${error}`
      }
    }

    default:
      return `Unknown command ${command}, see: "help"`
    }
  }

  public setStorageRoomName(storageRoomName: RoomName): void {
    this.storageRoomName = storageRoomName
  }

  public runOnTick(): void {
    this.droppedResources = null

    const roomResources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResources == null) {
      PrimitiveLogger.programError(`${this.taskIdentifier} ${roomLink(this.parentRoomName)} is not owned`)
      return
    }

    const harvesters: Creep[] = []
    const haulers: Creep[] = []

    World.resourcePools.getCreeps(this.parentRoomName, this.taskIdentifier, () => true).forEach(creep => {
      if (hasNecessaryRoles(creep, [...this.harvesterRoles])) {
        harvesters.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, [...this.haulerRoles])) {
        haulers.push(creep)
        return
      }
    })

    if (harvesters.length <= 0 && haulers.length <= 0) {
      if (this.suspendReasons.includes(tooLongCooldownReason) === true) {
        OperatingSystem.os.killProcess(this.processId)
        return
      }
    }

    if (harvesters.length < this.creepSpec.harvesterCount) {
      const energyNeeded = 2300
      if (roomResources.room.energyCapacityAvailable >= energyNeeded) {
        this.spawnHarvester(roomResources)
        processLog(this, `Cannot spawn harvester in ${roomLink(this.parentRoomName)}, lack of energy ${roomResources.room.energyCapacityAvailable}`)
      }
    } else if (haulers.length < this.creepSpec.haulerCount) {
      if (haulers.length <= 0) {
        this.spawnHauler(roomResources)
      } else {
        const longestTicksToLive = haulers.reduce((result, current) => {
          const ticksToLive = current.ticksToLive ?? GameConstants.creep.life.lifeTime
          if (ticksToLive > result) {
            return ticksToLive
          }
          return result
        }, 0)

        const threshold = GameConstants.creep.life.lifeTime - 100
        if (longestTicksToLive <= threshold) {
          this.spawnHauler(roomResources)
        }
      }
    }

    const targetRoom = Game.rooms[this.depositInfo.roomName]
    const deposit = Game.getObjectById(this.depositInfo.depositId)
    if (deposit != null && deposit.cooldown > maxCooldown) {
      this.addSuspendReason(tooLongCooldownReason)
    }
    if (targetRoom != null && deposit == null) {
      this.addSuspendReason("missing deposit")
    }
    this.assignTasks(deposit, harvesters)
  }

  private spawnHarvester(roomResources: OwnedRoomResource): void {
    if (this.canSpawn(roomResources) !== true) {
      return
    }
    // RCL6 2300e 6C20W20M
    const baseBody: BodyPartConstant[] = [
    ]
    const bodyUnit: BodyPartConstant[] = [
      CARRY, CARRY,
      MOVE, MOVE, MOVE, MOVE,
      WORK, WORK, WORK, WORK,
    ]
    const body = CreepBody.create(baseBody, bodyUnit, roomResources.room.energyCapacityAvailable, 5)
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [...this.harvesterRoles],
      body,
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    })
  }

  private spawnHauler(roomResources: OwnedRoomResource): void {
    if (this.canSpawn(roomResources) !== true) {
      return
    }
    // RCL6 2300e 20C20M
    const baseBody: BodyPartConstant[] = []
    const bodyUnit: BodyPartConstant[] = [
      CARRY, CARRY, CARRY, CARRY, CARRY,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]
    const body = CreepBody.create(baseBody, bodyUnit, roomResources.room.energyCapacityAvailable, 2)
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [...this.haulerRoles],
      body,
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    })
  }

  private canSpawn(roomResources: OwnedRoomResource): boolean {
    if (this.suspendReasons.length > 0) {
      return false
    }
    return this.hasEnoughEnergy(roomResources)
  }

  private hasEnoughEnergy(roomResources: OwnedRoomResource): boolean {
    const storedEnergyThreshold = 40000
    const storedEnergy = (roomResources.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      + (roomResources.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)

    return storedEnergy >= storedEnergyThreshold
  }

  private assignTasks(deposit: Deposit | null, harvesters: Creep[]): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => this.newHarvesterTask(creep, deposit),
      creep => hasNecessaryRoles(creep, [...this.harvesterRoles])
    )

    const carryingCommodityHarvesters = harvesters.filter(harvester => harvester.store.getUsedCapacity(this.depositInfo.commodityType) > 0)
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => this.newHaulerTask(creep, carryingCommodityHarvesters, deposit),
      creep => hasNecessaryRoles(creep, [...this.haulerRoles])
    )
  }

  private newHarvesterTask(creep: Creep, deposit: Deposit | null): CreepTask | null {
    if (creep.room.name !== this.depositInfo.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.depositInfo.roomName) ?? []
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.depositInfo.roomName, waypoints))
    }

    this.refreshDroppedResources(creep.room)
    if (this.droppedResources != null) {
      const resource = creep.pos.findClosestByPath(this.droppedResources)
      if (resource != null) {
        return FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawApiWrapper.create(resource)))
      }
    }

    if (deposit == null) {
      creep.say("no deposit")
      return null
    }
    if (creep.store.getFreeCapacity() <= 0) {
      creep.say("full")
      return null
    }
    const harvestResult = creep.harvest(deposit)
    switch (harvestResult) {
    case OK:
    case ERR_TIRED:
      return null
    case ERR_NOT_IN_RANGE:
      return FleeFromAttackerTask.create(MoveToTask.create(deposit.pos, 1))
    default:
      creep.say(`${harvestResult}`)
      return null
    }
  }

  private newHaulerTask(creep: Creep, carryingCommodityHarvesters: Creep[], deposit: Deposit | null): CreepTask | null {
    const shouldReturnToParentRoom = ((): boolean => {
      const storeAmount = creep.store.getUsedCapacity(this.depositInfo.commodityType)
      if (storeAmount <= 0) {
        return false
      }
      if (creep.store.getFreeCapacity() <= 0) {
        return true
      }
      if (creep.room.name !== this.depositInfo.roomName) {
        return true
      }
      if (creep.ticksToLive != null && creep.ticksToLive < 200) {
        return true
      }
      if (carryingCommodityHarvesters.length > 0) {
        return false
      }
      if (deposit != null) {
        if (storeAmount > 100 && deposit.cooldown > 25) {
          return true
        }
      }
      return false
    })()

    const storageRoomName = this.storageRoomName ?? this.parentRoomName
    const storageRoomResource = RoomResources.getOwnedRoomResource(storageRoomName)
    if (storageRoomResource == null) {
      PrimitiveLogger.programError(`${this.constructor.name}.newHaulerTask() no room resource for ${roomLink(storageRoomName)}`)
      return null
    }

    if (shouldReturnToParentRoom === true) {
      const waypoints = GameMap.getWaypoints(creep.room.name, storageRoomName) ?? []
      const tasks: CreepTask[] = [
        MoveToRoomTask.create(storageRoomName, waypoints),
      ]
      const transferTarget: StructureTerminal | StructureStorage | null = storageRoomResource.activeStructures.terminal ?? storageRoomResource.activeStructures.storage
      if (transferTarget != null) {
        tasks.push(MoveToTargetTask.create(TransferResourceApiWrapper.create(transferTarget, this.depositInfo.commodityType)))
      }
      return FleeFromAttackerTask.create(SequentialTask.create(tasks, {finishWhenSucceed: false, ignoreFailure: false}))
    }

    if (creep.room.name !== this.depositInfo.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.depositInfo.roomName) ?? []
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.depositInfo.roomName, waypoints))
    }

    if (deposit == null) {
      return null
    }

    if (creep.pos.getRangeTo(deposit) > 2) {
      return FleeFromAttackerTask.create(MoveToTask.create(deposit.pos, 2))
    }

    const harvester = creep.pos.findClosestByRange(carryingCommodityHarvesters)
    if (harvester == null) {
      this.refreshDroppedResources(creep.room)
      if (this.droppedResources != null) {
        const resource = creep.pos.findClosestByPath(this.droppedResources)
        if (resource != null) {
          return FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawApiWrapper.create(resource)))
        }
      }
      return null
    }
    if (harvester.transfer(creep, this.depositInfo.commodityType) === ERR_NOT_IN_RANGE) {
      return FleeFromAttackerTask.create(MoveToTask.create(harvester.pos, 1))
    }
    return null
  }

  private addSuspendReason(reason: string): void {
    if (this.suspendReasons.includes(reason) !== true) {
      this.suspendReasons.push(reason)
    }
  }

  private refreshDroppedResources(targetRoom: Room): void {
    if (this.droppedResources != null) {
      return
    }
    this.droppedResources = [
      ...targetRoom.find(FIND_TOMBSTONES).filter(tombstone => tombstone.store.getUsedCapacity(this.depositInfo.commodityType) > 0),
      ...targetRoom.find(FIND_DROPPED_RESOURCES).filter(resource => resource.resourceType === this.depositInfo.commodityType),
    ]
  }
}
