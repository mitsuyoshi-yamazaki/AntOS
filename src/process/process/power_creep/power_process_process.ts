import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepRole } from "prototype/creep_role"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { Run1TickTask } from "v5_object_task/creep_task/combined_task/run_1_tick_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { ProcessDecoder } from "process/process_decoder"
import { RoomResources } from "room_resource/room_resources"
import { OperatingSystem } from "os/os"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

ProcessDecoder.register("PowerProcessProcess", state => {
  return PowerProcessProcess.decode(state as PowerProcessProcessState)
})

export interface PowerProcessProcessState extends ProcessState {
  /** parent room name */
  r: RoomName

  /** power spawn id */
  p: Id<StructurePowerSpawn>
}

export class PowerProcessProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly powerSpawnId: Id<StructurePowerSpawn>,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): PowerProcessProcessState {
    return {
      t: "PowerProcessProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.parentRoomName,
      p: this.powerSpawnId,
    }
  }

  public static decode(state: PowerProcessProcessState): PowerProcessProcess | null {
    return new PowerProcessProcess(state.l, state.i, state.r, state.p)
  }

  public static create(processId: ProcessId, roomName: RoomName, powerSpawnId: Id<StructurePowerSpawn>): PowerProcessProcess {
    return new PowerProcessProcess(Game.time, processId, roomName, powerSpawnId)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResource == null) {
      return
    }
    const powerSpawn = Game.getObjectById(this.powerSpawnId)
    if (powerSpawn == null) {
      PrimitiveLogger.fatal(`${this.taskIdentifier} no power spawn found in ${roomLink(this.parentRoomName)}, ${this.powerSpawnId}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const powerAmount = roomResource.getResourceAmount(RESOURCE_POWER)
    const energyAmount = roomResource.getResourceAmount(RESOURCE_ENERGY)
    const hasEnoughEnergy = energyAmount > 150000

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (creepCount <= 0 && powerAmount > 0 && hasEnoughEnergy === true) {
      World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [CreepRole.Hauler, CreepRole.Mover],
        body: [MOVE, CARRY],
        initialTask: null,
        taskIdentifier: this.identifier,
        parentRoomName: null,
      })
    }

    this.runHauler(powerSpawn, roomResource)

    if (hasEnoughEnergy === true) {
      powerSpawn.processPower()
    }
  }

  private runHauler(powerSpawn: StructurePowerSpawn, roomResource: OwnedRoomResource): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.haulerTask(creep, powerSpawn, roomResource),
      () => true,
    )
  }

  private haulerTask(creep: Creep, powerSpawn: StructurePowerSpawn, roomResource: OwnedRoomResource): CreepTask | null {
    if (creep.store.getUsedCapacity() <= 0) {
      if (creep.ticksToLive != null && creep.ticksToLive < 100) {
        return EndlessTask.create()
      }

      if (powerSpawn.store.getUsedCapacity(RESOURCE_POWER) < 50) {
        const powerStore = ((): StructureContainer | StructureStorage | StructureTerminal | null => {
          const container = roomResource.room.find(FIND_STRUCTURES)
            .find(structure => structure.structureType === STRUCTURE_CONTAINER && structure.store.getUsedCapacity(RESOURCE_POWER) > 0) as StructureContainer | null
          if (container != null) {
            return container
          }
          if (roomResource.activeStructures.storage != null && roomResource.activeStructures.storage.store.getUsedCapacity(RESOURCE_POWER) > 0) {
            return roomResource.activeStructures.storage
          }
          return roomResource.activeStructures.terminal
        })()
        if (powerStore != null) {
          return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(powerStore, RESOURCE_POWER))
        }
        creep.say("no terminal")
        return null
      }
      // creep.say("waiting..")

      const moveToWaitingPositionTask = this.moveToWaitingPositionTask(roomResource)
      if (moveToWaitingPositionTask != null) {
        return Run1TickTask.create(moveToWaitingPositionTask, {duration: 5})
      }

      if (creep.pos.findInRange(FIND_STRUCTURES, 0, { filter: {structureType: STRUCTURE_ROAD}}).length <= 0) {
        return null
      }
      const filteringOptions: RoomPositionFilteringOptions = {
        excludeItself: true,
        excludeStructures: true,
        excludeWalkableStructures: true,
        excludeTerrainWalls: true,
      }
      const waitingPosition = powerSpawn.pos.positionsInRange(1, filteringOptions)[0]
      if (waitingPosition == null) {
        return null
      }
      return Run1TickTask.create(MoveToTask.create(waitingPosition, 0))
    }

    return MoveToTargetTask.create(TransferResourceApiWrapper.create(powerSpawn, RESOURCE_POWER))
  }

  private moveToWaitingPositionTask(roomResource: OwnedRoomResource): CreepTask | null {
    const waitingPosition = roomResource.roomInfoAccessor.config.getGenericWaitingPosition()
    if (waitingPosition == null) {
      return null
    }
    return MoveToTask.create(waitingPosition, 0)
  }
}
