import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
import { World } from "world_info/world_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { GameMap } from "game/game_map"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { AttackControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_controller_api_wrapper"
import { ClaimControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/claim_controller_api_wrapper"
import { GclFarmPositions } from "./gcl_farm_predefined_plans"
import { GclFarmRoomPlan } from "./gcl_farm_planner"
import { CreepBody } from "utility/creep_body"
import { GameConstants } from "utility/constants"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { OperatingSystem } from "os/os"
import { GclFarmDeliverTarget, GclFarmResources } from "room_resource/gcl_farm_resources"
import { decodeRoomPosition, Position } from "prototype/room_position"
import { defaultMoveToOptions } from "prototype/creep"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { Sign } from "game/sign"
import { EnergyChargeableStructure } from "prototype/room_object"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"
import { TowerPoolTaskPriority, TowerTask } from "world_info/resource_pool/tower_resource_pool"

ProcessDecoder.register("GclFarmProcess", state => {
  return GclFarmProcess.decode(state as GclFarmProcessState)
})

type EnergyStoreType = StructureStorage | StructureContainer

const claimerRoles: CreepRole[] = [CreepRole.Claimer]
const distributorRoles: CreepRole[] = [CreepRole.EnergySource]
const upgraderRoles: CreepRole[] = [CreepRole.Worker]
const haulerRoles: CreepRole[] = [CreepRole.Hauler]

type RoomState = {
  noHostileStructures: boolean
  alternativeContainerId: Id<StructureContainer> | null
  constructingStorage: boolean
}

interface GclFarmProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly parentRoomNames: RoomName[]
  readonly positions: GclFarmPositions
  readonly upgraderIndex: number
  readonly roomState: RoomState
}

export class GclFarmProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string
  private readonly roomPlan: GclFarmRoomPlan

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly parentRoomNames: RoomName[],
    private readonly positions: GclFarmPositions,
    private upgraderIndex: number,
    private readonly roomState: RoomState,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
    this.roomPlan = new GclFarmRoomPlan(roomName, positions)

    GclFarmResources.setDeliverDestination(this.roomName, this.roomPlan.positions.distributorPosition)
  }

  public encode(): GclFarmProcessState {
    return {
      t: "GclFarmProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      parentRoomNames: this.parentRoomNames,
      positions: this.positions,
      upgraderIndex: this.upgraderIndex,
      roomState: this.roomState,
    }
  }

  public static decode(state: GclFarmProcessState): GclFarmProcess {
    return new GclFarmProcess(state.l, state.i, state.roomName, state.parentRoomNames, state.positions, state.upgraderIndex, state.roomState)
  }

  public static create(processId: ProcessId, targetRoom: Room, parentRoomNames: RoomName[], positions: GclFarmPositions): GclFarmProcess {
    const noHostileStructures = targetRoom.find(FIND_HOSTILE_STRUCTURES).length <= 0

    const roomState: RoomState = {
      noHostileStructures,
      alternativeContainerId: null,
      constructingStorage: false,
    }
    return new GclFarmProcess(Game.time, processId, targetRoom.name, parentRoomNames, positions, 0, roomState)
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)}, parents: ${this.parentRoomNames.map(roomName => roomLink(roomName)).join(",")}`
  }

  public runOnTick(): void {
    const parentRoomResources = this.parentRoomNames.flatMap((roomName): OwnedRoomResource[] => {
      const roomResource = RoomResources.getOwnedRoomResource(roomName)
      if (roomResource == null) {
        return []
      }
      return [roomResource]
    })
    if (parentRoomResources[0] == null) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }
    const firstParentRoomResource = parentRoomResources[0]

    const claimers: Creep[] = []
    const distributors: Creep[] = []
    const upgraders: Creep[] = []
    const haulers: Creep[] = []

    const creepList = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)
    creepList.forEach(creep => {
      if (hasNecessaryRoles(creep, haulerRoles) === true) {
        haulers.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, upgraderRoles) === true) {
        upgraders.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, distributorRoles) === true) {
        distributors.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, claimerRoles) === true) {
        claimers.push(creep)
        return
      }
    })

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      this.claimRoom(claimers.length, firstParentRoomResource.room.name)
      return
    }

    this.runTowers(roomResource)
    this.runSpawn(roomResource)
    this.buildStructures(roomResource)

    if (this.roomState.noHostileStructures !== true) {
      this.destroyHostileStructures(roomResource.room)
    }

    const upgraderMaxCount = 4
    const getAlternativeContainer = (): StructureContainer | null => {
      if (this.roomState.alternativeContainerId == null) {
        return null
      }
      return Game.getObjectById(this.roomState.alternativeContainerId) ?? null
    }
    const energySource = roomResource.room.storage ?? getAlternativeContainer()
    const needsEnergyTransfer = energySource == null || energySource.isActive() === true

    if (needsEnergyTransfer === true) {
      this.spawnDistributor(distributors, firstParentRoomResource, energySource != null)
    }

    let deliverTarget = ((): GclFarmDeliverTarget | null => {
      if (needsEnergyTransfer === true) {
        return energySource
      }
      return null
    })()

    distributors.forEach(creep => {
      const result = this.runDistributor(creep, [...upgraders], energySource, roomResource)
      if (result.isDeliverTarget === true && deliverTarget == null) {
        deliverTarget = creep
      }
    })

    GclFarmResources.setDeliverTarget(this.roomName, deliverTarget?.id ?? null)

    this.spawnUpgrader(upgraders.length, upgraderMaxCount, parentRoomResources)

    const upgraderPositionCount = this.positions.upgraderPositions.length
    if ((Game.time % 10) === 0) {
      this.upgraderIndex = (this.upgraderIndex + 1) % upgraderPositionCount
    }

    for (let i = 0; i < upgraders.length; i += 1) {
      const creep = upgraders[i]
      const position = this.positions.upgraderPositions[(i + this.upgraderIndex) % upgraderPositionCount]
      if (creep == null || position == null) {
        continue
      }
      this.runUpgrader(creep, roomResource.controller, position, energySource)
    }

    const energyStores = parentRoomResources.flatMap((resource): StructureStorage[] => {
      if (resource.activeStructures.storage == null) {
        return []
      }
      if (resource.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 100000) {
        return []
      }
      return [resource.activeStructures.storage]
    })

    if (energyStores.length > 0) {
      const haulerMaxCount = 7
      if (needsEnergyTransfer === true) {
        this.spawnHauler(haulers.length, haulerMaxCount, parentRoomResources)
      }

      energyStores.sort((lhs, rhs) => {
        return rhs.store.getUsedCapacity(RESOURCE_ENERGY) - lhs.store.getUsedCapacity(RESOURCE_ENERGY)
      })

      haulers.forEach(creep => this.runHauler(creep, energyStores, deliverTarget, roomResource))
    } else {
      haulers.forEach(creep => creep.say("no source"))
    }
  }

  // ---- Build ---- //
  private buildStructures(roomResource: OwnedRoomResource): void {
    const constructionSite = roomResource.constructionSites[0]
    if (constructionSite != null) {
      if (this.roomState.constructingStorage !== true && constructionSite.structureType === STRUCTURE_STORAGE) {
        this.roomState.constructingStorage = true
      }
      return
    }

    if (this.roomState.constructingStorage === true && roomResource.activeStructures.storage != null) {
      this.roomState.constructingStorage = false
    }

    switch (roomResource.controller.level) {
    case 1:
      this.checkAlternativeContainer(roomResource.room)
      if (roomResource.activeStructures.spawns.length <= 0) {
        this.createSpawnConstructionSite(roomResource.room)
      }
      return

    case 2:
      this.checkAlternativeContainer(roomResource.room)
      return

    case 3:
      if (roomResource.activeStructures.towers.length <= 0) {
        this.createTowerConstructionSite(roomResource.room)
      }
      this.checkAlternativeContainer(roomResource.room)
      return

    case 4:
      if (roomResource.activeStructures.storage == null) {
        this.createStorageConstructionSite(roomResource.room)
      }
      return

    case 5:
      if (roomResource.activeStructures.towers.length <= 1) {
        this.createTowerConstructionSite(roomResource.room)
      }
      return

    case 6:
    case 7:
      // TODO: tower三つ目
      return

    case 8:
    default:
      return
    }
  }

  private checkAlternativeContainer(room: Room): void {
    if (room.storage == null && this.roomState.alternativeContainerId == null) {
      const container = this.roomPlan.storagePosition.findInRange(FIND_STRUCTURES, 0, { filter: {structureType: STRUCTURE_CONTAINER}})[0] as StructureContainer | null
      if (container != null) {
        this.roomState.alternativeContainerId = container.id
        return
      }
      this.createContainerConstructionSite(room)
    }
  }

  private createSpawnConstructionSite(room: Room): void {
    const position = this.positions.spawnPosition
    room.createConstructionSite(position.x, position.y, STRUCTURE_SPAWN)
  }

  private createContainerConstructionSite(room: Room): void {
    const position = this.positions.storagePosition
    room.createConstructionSite(position.x, position.y, STRUCTURE_CONTAINER)
  }

  private createTowerConstructionSite(room: Room): void {
    const positions: Position[] = [
      this.positions.tower1Position,
      this.positions.tower2Position,
    ]

    for (const position of positions) {
      const result = room.createConstructionSite(position.x, position.y, STRUCTURE_TOWER)
      if (result === OK) {
        return
      }
    }
  }

  private createStorageConstructionSite(room: Room): void {
    const position = this.roomPlan.storagePosition
    const result = room.createConstructionSite(position, STRUCTURE_STORAGE)

    if (result === ERR_INVALID_TARGET) {
      const container = position.findInRange(FIND_STRUCTURES, 0, { filter: { structureType: STRUCTURE_CONTAINER } })[0]
      if (container != null) {
        container.destroy()
        this.roomState.alternativeContainerId = null
        return
      }

      const constructionSite = position.findInRange(FIND_MY_CONSTRUCTION_SITES, 0)[0]
      if (constructionSite != null) {
        if (constructionSite.structureType === STRUCTURE_STORAGE) {
          PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} trying to remove storage construction site`)
          return
        }
        constructionSite.remove()
        return
      }
    }
  }

  // ---- Hauler ---- //
  private spawnHauler(haulerCount: number, haulerMaxCount: number, parentRoomResources: OwnedRoomResource[]): void {
    if (parentRoomResources.length <= 0) {
      return
    }
    if (haulerCount >= haulerMaxCount) {
      return
    }

    parentRoomResources.forEach(parentRoomResource => {
      const body = CreepBody.create([], [CARRY, MOVE], parentRoomResource.room.energyCapacityAvailable, 20)

      World.resourcePools.addSpawnCreepRequest(parentRoomResource.room.name, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [...haulerRoles],
        body,
        initialTask: null,
        taskIdentifier: this.taskIdentifier,
        parentRoomName: this.roomName,
      })
    })
  }

  private runHauler(creep: Creep, energyStores: StructureStorage[], deliverTarget: GclFarmDeliverTarget | null, roomResource: OwnedRoomResource): void {
    if (creep.v5task != null) {
      return
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      const tasks: CreepTask[] = []
      if (creep.room.name !== this.roomName) {
        tasks.push(MoveToRoomTask.create(this.roomName, []))
      }
      if (deliverTarget != null) {
        tasks.push(MoveToTargetTask.create(TransferEnergyApiWrapper.create(deliverTarget)))
      }
      creep.v5task = SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
      return
    }

    const droppedResource = creep.pos.findClosestByRange(roomResource.droppedResources)
    if (droppedResource != null) {
      creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(PickupApiWrapper.create(droppedResource)))
      return
    }

    const energyStore = ((): StructureStorage | null => {
      const storageInSameRoom = energyStores.find(storage => storage.room.name === creep.room.name)
      return storageInSameRoom ?? energyStores[0] ?? null
    })()

    if (energyStore == null) {
      return
    }

    const tasks: CreepTask[] = []
    if (creep.room.name !== energyStore.room.name) {
      tasks.push(MoveToRoomTask.create(energyStore.room.name, []))
    }
    tasks.push(MoveToTargetTask.create(WithdrawResourceApiWrapper.create(energyStore, RESOURCE_ENERGY)))

    creep.v5task = SequentialTask.create(tasks, {ignoreFailure: false, finishWhenSucceed: false})
  }

  // ---- Upgrader ---- //
  private spawnUpgrader(upgraderCount: number, upgraderMaxCount: number, parentRoomResources: OwnedRoomResource[]): void {
    if (parentRoomResources.length <= 0) {
      return
    }
    if (upgraderCount >= upgraderMaxCount) {
      return
    }

    parentRoomResources.forEach(parentRoomResource => {
      const body = CreepBody.create([CARRY, CARRY, CARRY], [MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK], parentRoomResource.room.energyCapacityAvailable, 5)

      World.resourcePools.addSpawnCreepRequest(parentRoomResource.room.name, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [...upgraderRoles],
        body,
        initialTask: null,
        taskIdentifier: this.taskIdentifier,
        parentRoomName: this.roomName,
      })
    })
  }

  private runUpgrader(creep: Creep, controller: StructureController, position: Position, energyStore: EnergyStoreType | null): void {
    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.roomName) {
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.roomName, []))
      return
    }

    const {x, y} = position
    if (creep.pos.isEqualTo(x, y) !== true) {
      if (creep.pos.getRangeTo(controller.pos) > GameConstants.creep.actionRange.upgradeController) {
        creep.v5task = FleeFromAttackerTask.create(MoveToTask.create(decodeRoomPosition(position, this.roomName), 0))
        return
      }

      const moveToOps: MoveToOpts = defaultMoveToOptions()
      moveToOps.ignoreCreeps = creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 // おかしな場所で渋滞している場合はエネルギーを得られないだろうという想定
      creep.moveTo(x, y, moveToOps)
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      const constructionSite = creep.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, GameConstants.creep.actionRange.build)[0]
      if (constructionSite != null) {
        creep.build(constructionSite)
      } else {
        creep.upgradeController(controller)
      }
    }

    if (energyStore != null && energyStore.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && creep.store.getFreeCapacity() > 0) {
      creep.withdraw(energyStore, RESOURCE_ENERGY)
    }
  }

  // ---- Distributor ---- //
  private spawnDistributor(distributors: Creep[], parentRoomResource: OwnedRoomResource, hasEnergyStore: boolean): void {
    if (distributors.length >= 2) {
      return
    }

    const maxBodyUnit = hasEnergyStore ? 16 : 40
    const body = CreepBody.create([MOVE], [CARRY], parentRoomResource.room.energyCapacityAvailable, maxBodyUnit)
    const shouldSpawn = ((): boolean => {
      const creep = distributors[0]
      if (creep == null) {
        return true
      }
      if (creep.ticksToLive == null) {
        return false
      }
      const threshold = CreepBody.spawnTime(body) + (GameConstants.room.size * 1.5)
      if (creep.ticksToLive < threshold) {
        return true
      }
      return false
    })()

    if (shouldSpawn !== true) {
      return
    }

    World.resourcePools.addSpawnCreepRequest(parentRoomResource.room.name, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [...distributorRoles],
      body,
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: this.roomName,
    })
  }

  private runDistributor(creep: Creep, upgraders: Creep[], energySource: EnergyStoreType | null, roomResource: OwnedRoomResource): {isDeliverTarget: boolean} {
    if (creep.v5task != null) {
      return {
        isDeliverTarget: false,
      }
    }

    if (creep.room.name !== this.roomName) {
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.roomName, []))
      return {
        isDeliverTarget: false,
      }
    }

    const pickupDroppedResource = (): void => {
      const droppedResource = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, { filter: { resourceType: RESOURCE_ENERGY } })[0]
      if (droppedResource == null) {
        return
      }
      creep.pickup(droppedResource)
    }

    const getStructureToCharge = (): EnergyChargeableStructure | null => {
      const chargeableStructures = roomResource.activeStructures.chargeableStructures.filter(structure => structure.pos.getRangeTo(creep.pos) <= 1)
      chargeableStructures.sort((lhs, rhs) => {
        return rhs.store.getFreeCapacity(RESOURCE_ENERGY) - lhs.store.getFreeCapacity(RESOURCE_ENERGY)
      })
      const structure = chargeableStructures[0]
      if (structure == null || structure.store.getFreeCapacity(RESOURCE_ENERGY) < 50) {
        return null
      }
      return structure
    }

    if (energySource == null) {  // Farmの立ち上げ中
      const position = this.roomState.constructingStorage === true ? this.roomPlan.distributorPosition : this.roomPlan.storagePosition
      if (creep.pos.isEqualTo(position) !== true) {
        creep.v5task = FleeFromAttackerTask.create(MoveToTask.create(position, 0, { ignoreSwamp: true }))
        return {
          isDeliverTarget: false,
        }
      }
      pickupDroppedResource()

      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        const structureToCharge = getStructureToCharge()
        if (structureToCharge != null) {
          creep.transfer(structureToCharge, RESOURCE_ENERGY)
          return {
            isDeliverTarget: true,
          }
        }

        const nearbyUpgraders = upgraders.filter(upgrader => upgrader.pos.isNearTo(creep.pos) === true)
        nearbyUpgraders.sort((lhs, rhs) => {
          return lhs.store.getUsedCapacity(RESOURCE_ENERGY) - rhs.store.getUsedCapacity(RESOURCE_ENERGY)
        })
        const transferTarget = nearbyUpgraders[0]
        if (transferTarget != null) {
          creep.transfer(transferTarget, RESOURCE_ENERGY)
        }
      }

      return {
        isDeliverTarget: true,
      }

    } else {  // Storage | Containerが存在する
      if (creep.pos.isEqualTo(this.roomPlan.distributorPosition) !== true) {
        creep.v5task = FleeFromAttackerTask.create(MoveToTask.create(this.roomPlan.distributorPosition, 0, { ignoreSwamp: true }))
        return {
          isDeliverTarget: false,
        }
      }
      pickupDroppedResource()


      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        if (creep.ticksToLive != null && creep.ticksToLive <= 1) {
          creep.transfer(energySource, RESOURCE_ENERGY)
          return {
            isDeliverTarget: false
          }
        }

        const structureToCharge = getStructureToCharge()
        if (structureToCharge != null) {
          creep.transfer(structureToCharge, RESOURCE_ENERGY)
          return {
            isDeliverTarget: false,
          }
        }
      }

      if (energySource.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        creep.withdraw(energySource, RESOURCE_ENERGY)
      }

      return {
        isDeliverTarget: false,
      }
    }
  }

  // ---- Claim Room ---- //
  private claimRoom(claimerCount: number, parentRoomName: RoomName): void {
    if (claimerCount <= 0) {
      this.spawnClaimer(parentRoomName)
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => this.claimerTask(creep),
      creep => hasNecessaryRoles(creep, claimerRoles),
    )
  }

  private spawnClaimer(parentRoomName: RoomName): void {
    World.resourcePools.addSpawnCreepRequest(parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [...claimerRoles],
      body: [CLAIM, MOVE],
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: this.roomName,
    })
  }

  private claimerTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.roomName) ?? []
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.roomName, waypoints))
    }

    const controller = creep.room.controller
    if (controller == null) {
      PrimitiveLogger.programError(`${this.taskIdentifier} no controller in ${roomLink(this.roomName)}`)
      return null
    }

    const shouldAttack = ((): boolean => {
      if (controller.owner != null && controller.owner.username !== Game.user.name) {
        return true
      }
      if (controller.reservation != null && controller.reservation.username !== Game.user.name) {
        return true
      }
      return false
    })()

    if (shouldAttack === true) {
      return FleeFromAttackerTask.create(MoveToTargetTask.create(AttackControllerApiWrapper.create(controller)))
    }

    const sign = ((): string | undefined => {
      if (controller.sign == null || controller.sign.username !== Game.user.name) {
        return Sign.signForGclFarm()
      }
      if (controller.sign.text.includes("Farm") !== true) {
        return Sign.signForGclFarm()
      }
      return undefined
    })()
    return FleeFromAttackerTask.create(MoveToTargetTask.create(ClaimControllerApiWrapper.create(controller, sign)))
  }

  private destroyHostileStructures(room: Room): void {
    let failed = false as boolean
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES)
    hostileStructures.forEach(structure => {
      const result = structure.destroy()
      switch (result) {
      case OK:
        return
      case ERR_BUSY:  // Hostile creeps are in the room.
        failed = true
        return
      case ERR_NOT_OWNER:
        failed = true
        PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} failed to destroy structure ${structure} in ${structure.pos}`)
        return
      }
    })

    if (failed !== true) {
      this.roomState.noHostileStructures = true
    }
  }

  // ---- Tower ---- //
  private runTowers(roomResources: OwnedRoomResource): void {
    const hostileCreep = roomResources.hostiles.creeps[0]
    if (hostileCreep != null) {
      World.resourcePools.addTowerTask(this.roomName, TowerTask.Attack(hostileCreep, TowerPoolTaskPriority.Urgent))
      return
    }

    const hostilePowerCreep = roomResources.hostiles.powerCreeps[0]
    if (hostilePowerCreep != null) {
      World.resourcePools.addTowerTask(this.roomName, TowerTask.Attack(hostilePowerCreep, TowerPoolTaskPriority.Urgent))
      return
    }

    const damagedCreep = roomResources.myCreeps.damagedCreeps[0]
    if (damagedCreep != null) {
      World.resourcePools.addTowerTask(this.roomName, TowerTask.Heal(damagedCreep, TowerPoolTaskPriority.Low))
      return
    }

    const damagedStructure = roomResources.damagedStructures[0] ?? roomResources.decayedStructures[0]
    if (damagedStructure != null) {
      World.resourcePools.addTowerTask(this.roomName, TowerTask.Repair(damagedStructure, TowerPoolTaskPriority.Low))
      return
    }
  }

  // ---- Spawn ---- //
  private runSpawn(roomResources: OwnedRoomResource): void {
    const spawn = roomResources.activeStructures.spawns[0]
    if (spawn == null) {
      return
    }

    const creepInfo = spawn.pos.findInRange(FIND_MY_CREEPS, 1).flatMap((creep): { creep: Creep, ticksToLive: number }[] => {
      if (creep.ticksToLive == null || creep.ticksToLive > 400) {
        return []
      }
      return [{
        creep,
        ticksToLive: creep.ticksToLive,
      }]
    })
    creepInfo.sort((lhs, rhs) => {
      return lhs.ticksToLive - rhs.ticksToLive
    })

    const creep = creepInfo[0]
    if (creep == null) {
      return
    }

    spawn.renewCreep(creep.creep)
  }
}
