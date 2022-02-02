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
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { DropResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"

ProcessDecoder.register("GclFarmProcess", state => {
  return GclFarmProcess.decode(state as GclFarmProcessState)
})

const claimerRoles: CreepRole[] = [CreepRole.Claimer]
const distributorRoles: CreepRole[] = [CreepRole.EnergySource]
const upgraderRoles: CreepRole[] = [CreepRole.Worker]
const haulerRoles: CreepRole[] = [CreepRole.Hauler]

type RoomState = {
  noHostileStructures: boolean
}

interface GclFarmProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly parentRoomNames: RoomName[]
  readonly positions: GclFarmPositions
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
      roomState: this.roomState,
    }
  }

  public static decode(state: GclFarmProcessState): GclFarmProcess {
    return new GclFarmProcess(state.l, state.i, state.roomName, state.parentRoomNames, state.positions, state.roomState)
  }

  public static create(processId: ProcessId, targetRoom: Room, parentRoomNames: RoomName[], positions: GclFarmPositions): GclFarmProcess {
    const noHostileStructures = targetRoom.find(FIND_HOSTILE_STRUCTURES).length <= 0

    const roomState: RoomState = {
      noHostileStructures,
    }
    return new GclFarmProcess(Game.time, processId, targetRoom.name, parentRoomNames, positions, roomState)
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

    if (this.roomState.noHostileStructures !== true) {
      this.destroyHostileStructures(roomResource.room)
    }

    const upgraderMaxCount = 4

    this.spawnDistributor(distributors, firstParentRoomResource)

    let deliverTarget: GclFarmDeliverTarget | null = null
    distributors.forEach(creep => {
      const result = this.runDistributor(creep, [...upgraders])
      if (result.isDeliverTarget === true) {
        GclFarmResources.setDeliverTarget(this.roomName, creep.id)
        deliverTarget = creep
      }
    })

    this.spawnUpgrader(upgraders.length, upgraderMaxCount, parentRoomResources)
    for (let i = 0; i < upgraders.length; i += 1) {
      const creep = upgraders[i]
      const position = this.positions.upgraderPositions[i % this.positions.upgraderPositions.length]
      if (creep == null || position == null) {
        continue
      }
      this.runUpgrader(creep, roomResource.controller, position)
    }

    const haulerMaxCount = 3
    this.spawnHauler(haulers.length, haulerMaxCount, parentRoomResources)

    const energyStore = ((): StructureStorage | null => {
      const storages = parentRoomResources.flatMap((resource): StructureStorage[] => {
        if (resource.activeStructures.storage != null) {
          return [resource.activeStructures.storage]
        }
        return []
      })
      storages.sort((lhs, rhs) => {
        return rhs.store.getUsedCapacity(RESOURCE_ENERGY) - lhs.store.getUsedCapacity(RESOURCE_ENERGY)
      })
      return storages[0] ?? null
    })()

    if (energyStore != null) {
      haulers.forEach(creep => this.runHauler(creep, energyStore, deliverTarget, this.roomPlan.positions.distributorPosition))
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

  private runHauler(creep: Creep, energyStore: StructureStorage, deliverTarget: GclFarmDeliverTarget | null, deliverPosition: Position): void {
    if (creep.v5task != null) {
      return
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      const tasks: CreepTask[] = []
      if (creep.room.name !== this.roomName) {
        tasks.push(MoveToRoomTask.create(this.roomName, []))
      }
      tasks.push(MoveToTask.create(decodeRoomPosition(deliverPosition, this.roomName), 0))
      if (deliverTarget != null) {
        tasks.push(RunApiTask.create(TransferEnergyApiWrapper.create(deliverTarget)))
      }
      tasks.push(RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY)))
      creep.v5task = SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
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
      const body = CreepBody.create([CARRY, CARRY, CARRY], [MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK], parentRoomResource.room.energyCapacityAvailable, 6)

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

  private runUpgrader(creep: Creep, controller: StructureController, position: Position): void {
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
      moveToOps.ignoreCreeps = true
      creep.moveTo(x, y, moveToOps)
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      creep.upgradeController(controller)
    }
  }

  // ---- Distributor ---- //
  private spawnDistributor(distributors: Creep[], parentRoomResource: OwnedRoomResource): void {
    if (distributors.length >= 2) {
      return
    }
    const body = CreepBody.create([MOVE], [CARRY], parentRoomResource.room.energyCapacityAvailable, 40)
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

  private runDistributor(creep: Creep, upgraders: Creep[]): {isDeliverTarget: boolean} {
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

    if (creep.pos.isEqualTo(this.roomPlan.storagePosition) !== true) {  // TODO: Storageを建てたらdistributorPositionに移動させる
      creep.v5task = FleeFromAttackerTask.create(MoveToTask.create(this.roomPlan.storagePosition, 0, { ignoreSwamp: true }))
      return {
        isDeliverTarget: false,
      }
    }

    const droppedResources = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, { filter: {resourceType: RESOURCE_ENERGY}})
    droppedResources.forEach(droppedResource => {
      creep.pickup(droppedResource)
    })

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      upgraders.sort((lhs, rhs) => {
        return lhs.store.getUsedCapacity(RESOURCE_ENERGY) - rhs.store.getUsedCapacity(RESOURCE_ENERGY)
      })
      const transferTarget = upgraders[0]
      if (transferTarget != null) {
        creep.transfer(transferTarget, RESOURCE_ENERGY)
      }
    }

    return {
      isDeliverTarget: true,
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
      creep => this.claimerRole(creep),
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

  private claimerRole(creep: Creep): CreepTask | null {
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

    return FleeFromAttackerTask.create(MoveToTargetTask.create(ClaimControllerApiWrapper.create(controller)))
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
}
