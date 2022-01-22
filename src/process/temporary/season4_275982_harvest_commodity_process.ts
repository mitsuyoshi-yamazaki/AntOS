import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
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

ProcessDecoder.register("Season4275982HarvestCommodityProcess", state => {
  return Season4275982HarvestCommodityProcess.decode(state as Season4275982HarvestCommodityProcessState)
})

const maxCooldown = 150

type DepositInfo = {
  readonly roomName: RoomName
  readonly commodityType: DepositConstant
  readonly currentCooldown: number
  readonly decayIn: number
  readonly neighbourCellCount: number
}

type CreepSpec = {
  readonly harvesterCount: number
  readonly haulerCount: number
}

export interface Season4275982HarvestCommodityProcessState extends ProcessState {
  readonly parentRoomName: RoomName
  readonly depositInfo: DepositInfo
  readonly creepSpec: CreepSpec
  readonly suspendReasons: string[]
}

export class Season4275982HarvestCommodityProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private readonly harvesterRoles: CreepRole[] = [CreepRole.Harvester]
  private readonly haulerRoles: CreepRole[] = [CreepRole.Hauler]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly parentRoomName: RoomName,
    private readonly depositInfo: DepositInfo,
    private readonly creepSpec: CreepSpec,
    private readonly suspendReasons: string[],
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season4275982HarvestCommodityProcessState {
    return {
      t: "Season4275982HarvestCommodityProcess",
      l: this.launchTime,
      i: this.processId,
      parentRoomName: this.parentRoomName,
      depositInfo: this.depositInfo,
      creepSpec: this.creepSpec,
      suspendReasons: this.suspendReasons,
    }
  }

  public static decode(state: Season4275982HarvestCommodityProcessState): Season4275982HarvestCommodityProcess {
    return new Season4275982HarvestCommodityProcess(state.l, state.i, state.parentRoomName, state.depositInfo, state.creepSpec, state.suspendReasons)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, depositInfo: DepositInfo, creepSpec: CreepSpec): Season4275982HarvestCommodityProcess {
    return new Season4275982HarvestCommodityProcess(Game.time, processId, parentRoomName, depositInfo, creepSpec, [])
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `${roomLink(this.parentRoomName)} -> ${coloredResourceType(this.depositInfo.commodityType)} in ${roomLink(this.depositInfo.roomName)}`
    ]
    if (this.suspendReasons.length > 0) {
      descriptions.push(`Not spawning due to: ${this.suspendReasons.join(", ")}`)
    }
    return descriptions.join(", ")
  }

  public runOnTick(): void {
    const roomResources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResources == null) {
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

    if (harvesters.length < this.creepSpec.harvesterCount) {
      const energyNeeded = 2300
      if (roomResources.room.energyCapacityAvailable > energyNeeded) {
        this.spawnHarvester(roomResources)
        processLog(this, `Cannot spawn harvester in ${roomLink(this.parentRoomName)}, lack of energy ${roomResources.room.energyCapacityAvailable}`)
      }
    } else if (haulers.length < this.creepSpec.haulerCount) {
      this.spawnHauler(roomResources)
    }

    const targetRoom = Game.rooms[this.depositInfo.roomName]
    const deposit = ((): Deposit | null => {
      if (targetRoom == null) {
        return null
      }
      return targetRoom.find(FIND_DEPOSITS)[0] ?? null
    })()
    if (deposit != null && deposit.cooldown > maxCooldown) {
      const message = "too long cooldown"
      if (this.suspendReasons.includes(message) !== true) {
        this.suspendReasons.push(message)
      }
    }
    this.assignTasks(deposit, harvesters, roomResources)
  }

  private spawnHarvester(roomResources: OwnedRoomResource): void {
    if (this.canSpawn(roomResources) !== true) {
      return
    }
    // RCL6 2300e 6C20W20M
    const baseBody: BodyPartConstant[] = [
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY,
    ]
    const bodyUnit: BodyPartConstant[] = [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      WORK, WORK, WORK, WORK, WORK,
    ]
    const body = CreepBody.create(baseBody, bodyUnit, roomResources.room.energyCapacityAvailable, 4)
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
    const body = CreepBody.create(baseBody, bodyUnit, roomResources.room.energyCapacityAvailable, 4)
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

    const storedEnergyThreshold = 40000
    const storedEnergy = (roomResources.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      + (roomResources.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)

    return storedEnergy >= storedEnergyThreshold
  }

  private assignTasks(deposit: Deposit | null, harvesters: Creep[], roomResources: OwnedRoomResource): void {
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
      creep => this.newHaulerTask(creep, carryingCommodityHarvesters, deposit, roomResources),
      creep => hasNecessaryRoles(creep, [...this.haulerRoles])
    )
  }

  private newHarvesterTask(creep: Creep, deposit: Deposit | null): CreepTask | null {
    if (creep.room.name !== this.depositInfo.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.depositInfo.roomName) ?? []
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.depositInfo.roomName, waypoints))
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

  private newHaulerTask(creep: Creep, carryingCommodityHarvesters: Creep[], deposit: Deposit | null, roomResources: OwnedRoomResource): CreepTask | null {
    const shouldReturnToParentRoom = ((): boolean => {
      if (creep.store.getUsedCapacity(this.depositInfo.commodityType) <= 0) {
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
      if (deposit != null && deposit.cooldown > (GameConstants.room.size * 2)) {
        return true
      }
      return false
    })()

    if (shouldReturnToParentRoom === true) {
      const waypoints = GameMap.getWaypoints(this.depositInfo.roomName, creep.room.name) ?? []
      const tasks: CreepTask[] = [
        MoveToRoomTask.create(this.parentRoomName, waypoints),
      ]
      const transferTarget: StructureTerminal | StructureStorage | null = roomResources.activeStructures.storage ?? roomResources.activeStructures.terminal
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
      return null
    }
    if (harvester.transfer(creep, this.depositInfo.commodityType) === ERR_NOT_IN_RANGE) {
      return FleeFromAttackerTask.create(MoveToTask.create(harvester.pos, 1))
    }
    return null
  }
}
