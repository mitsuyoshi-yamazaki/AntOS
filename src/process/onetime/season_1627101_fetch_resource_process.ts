import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { OperatingSystem } from "os/os"
import { processLog } from "process/process_log"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"

export interface Season1627101FetchResourceProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  transferResourceType: ResourceConstant | null
  withdrawResourceType: ResourceConstant
}

// Game.io("launch -l Season1627101FetchResourceProcess room_name=W24S29 target_room_name=W21S28 waypoints=W22S29,W22S28 transfer=none withdraw=H")
export class Season1627101FetchResourceProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly haulerRoles: CreepRole[] = [CreepRole.Hauler, CreepRole.Mover]
  private readonly haulerBody: BodyPartConstant[] = [
    CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
    CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
    CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    public readonly transferResourceType: ResourceConstant | null,
    public readonly withdrawResourceType: ResourceConstant,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1627101FetchResourceProcessState {
    return {
      t: "Season1627101FetchResourceProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      transferResourceType: this.transferResourceType,
      withdrawResourceType: this.withdrawResourceType,
    }
  }

  public static decode(state: Season1627101FetchResourceProcessState): Season1627101FetchResourceProcess {
    return new Season1627101FetchResourceProcess(state.l, state.i, state.p, state.tr, state.w, state.transferResourceType, state.withdrawResourceType)
  }

  public static create(
    processId: ProcessId,
    parentRoomName: RoomName,
    targetRoomName: RoomName,
    waypoints: RoomName[],
    transferResourceType: ResourceConstant | null,
    withdrawResourceType: ResourceConstant
  ): Season1627101FetchResourceProcess {
    return new Season1627101FetchResourceProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, transferResourceType, withdrawResourceType)
  }

  public processShortDescription(): string {
    return `${this.withdrawResourceType} from ${roomLink(this.targetRoomName)}`
  }

  public runOnTick(): void {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (creepCount < 1) {
      this.requestHauler()
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.haulerTask(creep),
      () => true,
    )
  }

  private requestHauler(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: this.haulerRoles,
      body: this.haulerBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private haulerTask(creep: Creep): CreepTask | null {
    if (creep.store.getUsedCapacity() <= 0) {
      if (creep.ticksToLive == null || creep.ticksToLive < 400) {
        return null
      }

      if (creep.room.name === this.parentRoomName) {
        if (this.transferResourceType == null) {
          return this.moveToTargetRoomTask()
        }

        const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
        if (objects == null) {
          PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
          return null
        }
        const transferResourceType = this.transferResourceType
        const resourceStore = ((): StructureTerminal | StructureStorage | null => {
          if (objects.activeStructures.terminal != null && objects.activeStructures.terminal.store.getUsedCapacity(transferResourceType) > 0) {
            return objects.activeStructures.terminal
          }
          if (objects.activeStructures.storage != null && objects.activeStructures.storage.store.getUsedCapacity(transferResourceType) > 0) {
            return objects.activeStructures.storage
          }
          return null
        })()
        if (resourceStore == null) {
          return this.moveToTargetRoomTask()
        }
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(resourceStore, transferResourceType))
      }

      if (creep.room.name === this.targetRoomName) {
        const resourceStore = ((): StructureTerminal | StructureStorage | null => {
          if (creep.room.terminal != null && creep.room.terminal.store.getUsedCapacity(this.withdrawResourceType) > 0) {
            return creep.room.terminal
          }
          if (creep.room.storage != null && creep.room.storage.store.getUsedCapacity(this.withdrawResourceType) > 0) {
            return creep.room.storage
          }
          return null
        })()
        if (resourceStore == null) {
          processLog(this, `${roomLink(this.targetRoomName)} has no more resource ${this.withdrawResourceType}`)
          OperatingSystem.os.suspendProcess(this.processId)
          return this.moveToParentRoomTask()
        }
        processLog(this, `Withdraw ${this.withdrawResourceType} from ${roomLink(this.targetRoomName)}`)
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(resourceStore, this.withdrawResourceType))
      }
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, []))
    }

    if (this.transferResourceType != null && creep.store.getUsedCapacity(this.transferResourceType) > 0) {
      if (creep.room.name === this.targetRoomName) {
        const resourceStore = creep.room.terminal ?? creep.room.storage
        if (resourceStore == null) {
          processLog(this, `No terminal nor storage found in ${roomLink(this.targetRoomName)} quitting...`)
          OperatingSystem.os.suspendProcess(this.processId)
          return null
        }
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(resourceStore, this.transferResourceType))
      }
      return this.moveToTargetRoomTask()
    }

    if (creep.store.getUsedCapacity(this.withdrawResourceType) > 0) {
      if (creep.room.name === this.parentRoomName) {
        const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
        if (objects == null) {
          PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
          return null
        }
        const resourceStore = objects.activeStructures.terminal ?? objects.activeStructures.storage
        if (resourceStore == null) {
          processLog(this, `No terminal nor storage found in ${roomLink(this.parentRoomName)} quitting...`)
          OperatingSystem.os.suspendProcess(this.processId)
          return null
        }
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(resourceStore, this.withdrawResourceType))
      }
      return this.moveToParentRoomTask()
    }

    processLog(this, `Unexpected state. creep store: ${Object.keys(creep.store)}, ${roomLink(creep.room.name)}`)
    return null
  }

  private moveToTargetRoomTask(): CreepTask {
    return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, this.waypoints))
  }

  private moveToParentRoomTask(): CreepTask {
    const waypoints = [...this.waypoints].reverse()
    return FleeFromAttackerTask.create(MoveToRoomTask.create(this.parentRoomName, waypoints))
  }
}
