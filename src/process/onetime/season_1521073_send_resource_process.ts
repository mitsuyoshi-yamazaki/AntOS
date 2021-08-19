
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { GameConstants } from "utility/constants"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { OwnedRoomObjects } from "world_info/room_info"
import { EnergyChargeableStructure } from "prototype/room_object"
import { DropResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { CreepBody } from "utility/creep_body"

const maxNumberOfCreeps = 2

export interface Season1521073SendResourceProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** waypoints */
  w: RoomName[]

  targetRoomName: RoomName
}

// Game.io("launch -l Season1521073SendResourceProcess room_name=W6S29 target_room_name=W6S27 waypoints=W5S29,W5S27")
// Game.io("launch -l Season1521073SendResourceProcess room_name=W27S26 target_room_name=W29S25 waypoints=W28S26,W28S25")
// Game.io("launch -l Season1521073SendResourceProcess room_name=W17S11 target_room_name=W15S8 waypoints=W17S10,W15S10,W15S8")
export class Season1521073SendResourceProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1521073SendResourceProcessState {
    return {
      t: "Season1521073SendResourceProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomName: this.targetRoomName,
      w: this.waypoints,
    }
  }

  public static decode(state: Season1521073SendResourceProcessState): Season1521073SendResourceProcess {
    return new Season1521073SendResourceProcess(state.l, state.i, state.p, state.targetRoomName, state.w)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[],): Season1521073SendResourceProcess {
    return new Season1521073SendResourceProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints)
  }

  public processShortDescription(): string {
    return `${roomLink(this.parentRoomName)} => ${roomLink(this.targetRoomName)}`
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (objects == null || targetRoomObjects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} or ${roomLink(this.targetRoomName)} lost`)
      return
    }

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    const energyStore = ((): StructureTerminal | StructureStorage | null => {
      if (objects.activeStructures.terminal != null && objects.activeStructures.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 3000) {
        return objects.activeStructures.terminal
      }
      if (objects.activeStructures.storage != null && objects.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 3000) {
        return objects.activeStructures.storage
      }
      return null
    })()
    if (energyStore == null) {
      return
    }
    const numberOfCreeps = ((): number => {
      if (objects.activeStructures.storage == null) {
        return 0
      }
      const energyAmount = objects.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY)
        + (objects.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      if (energyAmount < 70000) {
        return 0
      }
      if (objects.activeStructures.terminal == null) {
        return 1
      }
      return maxNumberOfCreeps
    })()
    if (creeps.length < numberOfCreeps && targetRoomObjects.activeStructures.terminal == null) {
      this.requestCreep(CreepBody.create([], [CARRY, MOVE], objects.controller.room.energyCapacityAvailable, 20))
    }

    this.runCreep(energyStore, targetRoomObjects)
  }

  private requestCreep(body: BodyPartConstant[]): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runCreep(energyStore: StructureTerminal | StructureStorage, targetRoomObjects: OwnedRoomObjects): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.creepTask(creep, energyStore, targetRoomObjects),
      () => true,
    )
  }

  private creepTask(creep: Creep, energyStore: StructureTerminal | StructureStorage, targetRoomObjects: OwnedRoomObjects): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      if (creep.ticksToLive != null && creep.ticksToLive < (GameConstants.creep.life.lifeTime / 3)) {
        return RunApiTask.create(SuicideApiWrapper.create())
      }
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(energyStore, RESOURCE_ENERGY))
    }

    const chargeableStructure = ((): EnergyChargeableStructure | StructureStorage | null => {
      const targetStorage = targetRoomObjects.activeStructures.storage
      if (targetStorage != null && targetStorage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        return targetStorage
      }
      return targetRoomObjects.getStructureToCharge(creep.pos)
    })()
    if (chargeableStructure == null) {
      const droppedEnergy = targetRoomObjects.droppedResources.find(resource => resource.resourceType === RESOURCE_ENERGY)
      if (droppedEnergy != null) {
        if (droppedEnergy.pos.isEqualTo(creep.pos) === true) {
          return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
        } else {
          return MoveToTask.create(droppedEnergy.pos, 0)
        }
      }
      const targetObject = targetRoomObjects.activeStructures.spawns[0] ?? targetRoomObjects.controller
      if (targetObject.pos.isNearTo(creep.pos) === true) {
        return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
      } else {
        return MoveToTask.create(targetObject.pos, 1)
      }
    }

    const options: SequentialTaskOptions = {
      ignoreFailure: false,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, this.waypoints),
      MoveToTargetTask.create(TransferEnergyApiWrapper.create(chargeableStructure)),
    ]
    return FleeFromAttackerTask.create(SequentialTask.create(tasks, options))
  }
}
