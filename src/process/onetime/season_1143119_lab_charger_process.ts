import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"

const roomName = "W14S28"
const labId1 = "61011ce4706bd898698bc8dc" as Id<StructureLab>
const labId2 = "6100dc7bfdeb8837badf5c0b" as Id<StructureLab>

const boost1 = RESOURCE_LEMERGIUM_ALKALIDE
const boost2 = RESOURCE_KEANIUM_OXIDE

type LabInfo = {
  boost: MineralBoostConstant,
  lab: StructureLab
}

export interface Season1143119LabChargerProcessState extends ProcessState {
}

export class Season1143119LabChargerProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.identifier = `${this.constructor.name}_${roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1143119LabChargerProcessState {
    return {
      t: "Season1143119LabChargerProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: Season1143119LabChargerProcessState): Season1143119LabChargerProcess {
    return new Season1143119LabChargerProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): Season1143119LabChargerProcess {
    return new Season1143119LabChargerProcess(Game.time, processId)
  }

  public processShortDescription(): string {
    return roomLink(roomName)
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(roomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(roomName)} lost`)
      return
    }

    const lab1 = Game.getObjectById(labId1)
    const lab2 = Game.getObjectById(labId2)
    if (lab1 == null || lab2 == null) {
      PrimitiveLogger.fatal(`${this.identifier} target lab not found ${roomLink(roomName)}`)
      return
    }

    const terminal = objects.activeStructures.terminal
    if (terminal == null) {
      PrimitiveLogger.fatal(`${this.identifier} target terminal not found ${roomLink(roomName)}`)
      return
    }

    const hasResource = terminal.store.getUsedCapacity(boost1) > 0 || terminal.store.getUsedCapacity(boost2) > 0

    const creepCount = World.resourcePools.countCreeps(roomName, this.identifier, () => true)
    if (hasResource === true && creepCount < 1) {
      this.requestCreep()
    }

    const labs: LabInfo[] = [
      {
        boost: boost1,
        lab: lab1,
      },
      {
        boost: boost2,
        lab: lab2,
      },
    ]
    this.runCreep(terminal, labs)
  }

  private requestCreep(): void {
    World.resourcePools.addSpawnCreepRequest(roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body: [CARRY, CARRY, MOVE, CARRY, CARRY, MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runCreep(terminal: StructureTerminal, labs: LabInfo[]): void {
    World.resourcePools.assignTasks(
      roomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.creepTask(creep, terminal, labs),
      () => true,
    )
  }

  private creepTask(creep: Creep, terminal: StructureTerminal, labs: LabInfo[]): CreepTask | null {
    for (const labInfo of labs) {
      if (creep.store.getUsedCapacity(labInfo.boost) <= 0) {
        continue
      }
      return MoveToTargetTask.create(TransferResourceApiWrapper.create(labInfo.lab, labInfo.boost))
    }

    for (const labInfo of labs) {
      if (labInfo.lab.store.getFreeCapacity(labInfo.boost) <= 0) {
        continue
      }
      if (terminal.store.getUsedCapacity(labInfo.boost) <= 0) {
        continue
      }
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, labInfo.boost))
    }
    return null
  }
}
