
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
import { SwampRunnerTransferTask } from "v5_object_task/creep_task/meta_task/swamp_runner_transfer_task"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { GameConstants } from "utility/constants"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { OwnedRoomObjects } from "world_info/room_info"
import { EnergyChargeableStructure } from "prototype/room_object"

const useSwampRunner = false as boolean

const swampRunnerRoles: CreepRole[] = [CreepRole.SwampRunner, CreepRole.Mover]
const swampRunnerBody: BodyPartConstant[] = [
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  MOVE,
]

const haulerRoles: CreepRole[] = [CreepRole.Hauler, CreepRole.Mover]
const haulerBody: BodyPartConstant[] = [
  CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
  CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
  CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
]

export interface Season1521073SendResourceProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** waypoints */
  w: RoomName[]

  targetRoomName: RoomName
}

// Game.io("launch -l Season1521073SendResourceProcess room_name=W6S29 target_room_name=W6S27 waypoints=W5S29,W5S27")
export class Season1521073SendResourceProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly isSwampRunner: boolean
  private readonly roles: CreepRole[]
  private readonly body: BodyPartConstant[]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    if (useSwampRunner === true) {
      this.roles = swampRunnerRoles
      this.body = swampRunnerBody
    } else {
      this.roles = haulerRoles
      this.body = haulerBody
    }
    this.isSwampRunner = this.roles.includes(CreepRole.SwampRunner)
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
    if (creeps.length < 1) {
      this.requestCreep()
    }

    this.runCreep(energyStore, targetRoomObjects)
  }

  private requestCreep(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: this.roles,
      body: this.body,
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
      if (creep.ticksToLive != null && creep.ticksToLive < (GameConstants.creep.life.lifeTime / 2)) {
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
      creep.say("nth to do")
      return null
    }

    if (this.isSwampRunner === true) {
      return SwampRunnerTransferTask.create(TransferResourceApiWrapper.create(chargeableStructure, RESOURCE_ENERGY))
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
