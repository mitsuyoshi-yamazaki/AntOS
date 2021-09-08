import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
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
import { OwnedRoomObjects } from "world_info/room_info"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { Run1TickTask } from "v5_object_task/creep_task/combined_task/run_1_tick_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"

export interface Season631744PowerProcessProcessState extends ProcessState {
  /** parent room name */
  r: RoomName

  /** power spawn id */
  p: Id<StructurePowerSpawn>
}

export class Season631744PowerProcessProcess implements Process, Procedural {
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

  public encode(): Season631744PowerProcessProcessState {
    return {
      t: "Season631744PowerProcessProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.parentRoomName,
      p: this.powerSpawnId,
    }
  }

  public static decode(state: Season631744PowerProcessProcessState): Season631744PowerProcessProcess | null {
    return new Season631744PowerProcessProcess(state.l, state.i, state.r, state.p)
  }

  public static create(processId: ProcessId, roomName: RoomName, powerSpawnId: Id<StructurePowerSpawn>): Season631744PowerProcessProcess {
    return new Season631744PowerProcessProcess(Game.time, processId, roomName, powerSpawnId)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }
    const powerSpawn = Game.getObjectById(this.powerSpawnId)
    if (powerSpawn == null) {
      if (objects.controller.level > 5) {
        PrimitiveLogger.fatal(`Power spawn in ${roomLink(this.parentRoomName)} not found`)
      }
      return
    }

    const powerAmount = (objects.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_POWER) ?? 0)
      + (objects.activeStructures.storage?.store.getUsedCapacity(RESOURCE_POWER) ?? 0)

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (creepCount <= 0 && powerAmount > 0) {
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

    this.runHauler(powerSpawn, objects)
    powerSpawn.processPower()
  }

  private runHauler(powerSpawn: StructurePowerSpawn, objects: OwnedRoomObjects): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.haulerTask(creep, powerSpawn, objects),
      () => true,
    )
  }

  private haulerTask(creep: Creep, powerSpawn: StructurePowerSpawn, objects: OwnedRoomObjects): CreepTask | null {
    if (creep.store.getUsedCapacity() <= 0) {
      if (creep.ticksToLive != null && creep.ticksToLive < 100) {
        return EndlessTask.create()
      }

      if (powerSpawn.store.getUsedCapacity(RESOURCE_POWER) < 50) {
        const powerStore = ((): StructureContainer | StructureStorage | StructureTerminal | null => {
          const container = objects.controller.room.find(FIND_STRUCTURES)
            .find(structure => structure.structureType === STRUCTURE_CONTAINER && structure.store.getUsedCapacity(RESOURCE_POWER) > 0) as StructureContainer | null
          if (container != null) {
            return container
          }
          if (objects.activeStructures.storage != null && objects.activeStructures.storage.store.getUsedCapacity(RESOURCE_POWER) > 0) {
            return objects.activeStructures.storage
          }
          return objects.activeStructures.terminal
        })()
        if (powerStore != null) {
          return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(powerStore, RESOURCE_POWER))
        }
        creep.say("no terminal")
        return null
      }
      creep.say("waiting..")
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
}
