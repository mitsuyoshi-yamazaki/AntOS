import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
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
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { OwnedRoomObjects } from "world_info/room_info"
import { EnergyChargeableStructure } from "prototype/room_object"
import { DropResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { CreepBody } from "utility/creep_body"
import { OperatingSystem } from "os/os"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"

ProcessDecoder.register("HaulEnergyProcess", state => {
  return HaulEnergyProcess.decode(state as HaulEnergyProcessState)
})

export interface HaulEnergyProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** waypoints */
  w: RoomName[]

  targetRoomName: RoomName
  finishWorking: number
  maxNumberOfCreeps: number
  stopSpawning: boolean
}

/** Haulerによる輸送 */
export class HaulEnergyProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly finishWorking: number,
    private readonly maxNumberOfCreeps: number,
    private stopSpawning: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): HaulEnergyProcessState {
    return {
      t: "HaulEnergyProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomName: this.targetRoomName,
      w: this.waypoints,
      finishWorking: this.finishWorking,
      maxNumberOfCreeps: this.maxNumberOfCreeps,
      stopSpawning: this.stopSpawning,
    }
  }

  public static decode(state: HaulEnergyProcessState): HaulEnergyProcess {
    return new HaulEnergyProcess(state.l, state.i, state.p, state.targetRoomName, state.w, state.finishWorking, state.maxNumberOfCreeps, state.stopSpawning ?? false)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], finishWorking: number, maxNumberOfCreeps: number): HaulEnergyProcess {
    return new HaulEnergyProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, finishWorking, maxNumberOfCreeps, false)
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier)
    const descriptions: string[] = [
      `${creepCount}cr`,
      `${roomLink(this.parentRoomName)} => ${roomLink(this.targetRoomName)}`,
    ]
    if (this.stopSpawning === true) {
      descriptions.push("spawn stopped")
    }
    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "stop", "resume"]
    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `Commands: ${commandList}`
    case "stop":
      this.stopSpawning = true
      return "spawn stopped"
    case "resume":
      this.stopSpawning = false
      return "spawn resumed"
    default:
      return `Invalid command ${commandList}. see "help"`
    }
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (objects == null || targetRoomObjects == null) {
      PrimitiveLogger.fatal(`${this.taskIdentifier} ${roomLink(this.parentRoomName)} or ${roomLink(this.targetRoomName)} lost`)
      return
    }
    if (targetRoomObjects.activeStructures.terminal != null) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier)
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
      return this.maxNumberOfCreeps
    })()
    if (creeps.length < numberOfCreeps && this.stopSpawning !== true) {
      const body = CreepBody.create([], [CARRY, MOVE], objects.controller.room.energyCapacityAvailable, 25)
      body.sort((lhs, rhs) => lhs === rhs ? 0 : lhs === MOVE ? 1 : -1)
      this.requestCreep(body)
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
    )
  }

  private creepTask(creep: Creep, energyStore: StructureTerminal | StructureStorage, targetRoomObjects: OwnedRoomObjects): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      if (creep.ticksToLive != null && creep.ticksToLive < this.finishWorking) {
        return RunApiTask.create(SuicideApiWrapper.create())
      }
      if (creep.room.name !== this.parentRoomName) {
        const waypoints = [...this.waypoints]
        waypoints.reverse()
        return MoveToRoomTask.create(this.parentRoomName, waypoints)
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
