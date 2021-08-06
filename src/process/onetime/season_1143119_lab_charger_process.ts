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
import { RoomName } from "utility/room_name"

// const labId1 = "61011ce4706bd898698bc8dc" as Id<StructureLab>
// const labId2 = "6100dc7bfdeb8837badf5c0b" as Id<StructureLab>
// const labId3 = "6101058b83089149347c9d2c" as Id<StructureLab>
// const labId4 = "6102750e8f86f5cb23f3328c" as Id<StructureLab>

type BoostTire = 1 | 2

const tire1Boosts: MineralBoostConstant[] = [
  RESOURCE_LEMERGIUM_OXIDE,
  RESOURCE_KEANIUM_OXIDE,
  RESOURCE_ZYNTHIUM_OXIDE,
]

const tire2Boosts: MineralBoostConstant[] = [
  RESOURCE_LEMERGIUM_ALKALIDE,
  RESOURCE_GHODIUM_ALKALIDE,
  RESOURCE_KEANIUM_OXIDE,
  RESOURCE_ZYNTHIUM_OXIDE,
]

type LabInfo = {
  boost: MineralBoostConstant,
  lab: StructureLab
}

export interface Season1143119LabChargerProcessState extends ProcessState {
  parentRoomName: RoomName
  labIds: Id<StructureLab>[]
  tire: BoostTire
}

// Game.io("launch -l Season1143119LabChargerProcess room_name=W3S24 tire=1 lab_ids=61072e7d8631b61addd464c2,6107707f22b7dd084bded966,6107c31e36a5b7de9159d0de")
// Game.io("launch -l Season1143119LabChargerProcess room_name=W14S28 tire=1 lab_ids=61011ce4706bd898698bc8dc,6100dc7bfdeb8837badf5c0b,6101058b83089149347c9d2c")
export class Season1143119LabChargerProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly boosts: MineralBoostConstant[]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly labIds: Id<StructureLab>[],
    private readonly tire: BoostTire,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    switch (this.tire) {
    case 1:
      this.boosts = [...tire1Boosts]
      break
    case 2:
      this.boosts = [...tire2Boosts]
      break
    }
  }

  public encode(): Season1143119LabChargerProcessState {
    return {
      t: "Season1143119LabChargerProcess",
      l: this.launchTime,
      i: this.processId,
      parentRoomName: this.parentRoomName,
      labIds: this.labIds,
      tire: this.tire,
    }
  }

  public static decode(state: Season1143119LabChargerProcessState): Season1143119LabChargerProcess {
    return new Season1143119LabChargerProcess(state.l, state.i, state.parentRoomName, state.labIds, state.tire)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, labIds: Id<StructureLab>[], tire: BoostTire): Season1143119LabChargerProcess {
    return new Season1143119LabChargerProcess(Game.time, processId, parentRoomName, labIds, tire)
  }

  public processShortDescription(): string {
    return `${roomLink(this.parentRoomName)} ${this.labIds.length}labs`
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      return
    }

    const labs: LabInfo[] = []
    for (let i = 0; i < this.labIds.length; i += 1) {
      const labId = this.labIds[i]
      if (labId == null) {
        PrimitiveLogger.programError(`${this.identifier} Unexpected null in ${this.labIds}, index ${i}`)
        return
      }
      const lab = Game.getObjectById(labId)
      if (lab == null) {
        PrimitiveLogger.fatal(`${this.identifier} target lab ${labId} not found ${roomLink(this.parentRoomName)}`)
        return
      }
      const boost = this.boosts[i]
      if (boost == null) {
        PrimitiveLogger.programError(`${this.identifier} Unsupported boost: ${this.labIds.length}labs but ${this.boosts.length}boosts`)
        return
      }
      labs.push({
        lab,
        boost,
      })
    }

    const terminal = objects.activeStructures.terminal
    if (terminal == null) {
      PrimitiveLogger.fatal(`${this.identifier} target terminal not found ${roomLink(this.parentRoomName)}`)
      return
    }

    const hasResource = labs.some(labInfo => (terminal.store.getUsedCapacity(labInfo.boost) > 0))
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (hasResource === true && creepCount < 1) {
      this.requestCreep()
    }

    this.runCreep(terminal, labs)
  }

  private requestCreep(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body: [CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runCreep(terminal: StructureTerminal, labs: LabInfo[]): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.creepTask(creep, terminal, labs),
      () => true,
    )
  }

  private creepTask(creep: Creep, terminal: StructureTerminal, labs: LabInfo[]): CreepTask | null {
    if (creep.ticksToLive != null && creep.ticksToLive < 50) {
      return null
    }

    if (creep.store.getUsedCapacity() > 0) {
      const resourceType = Object.keys(creep.store)[0] as ResourceConstant | null
      if (resourceType != null && labs.every(l => l.boost !== resourceType)) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, resourceType))
      }
    }

    for (const labInfo of labs) {
      if (creep.store.getUsedCapacity(labInfo.boost) <= 0) {
        continue
      }
      if (labInfo.lab.store.getFreeCapacity(labInfo.boost) <= 0) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, labInfo.boost))
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

    if (creep.store.getUsedCapacity() <= 0) {
      for (const labInfo of labs) {
        if (labInfo.lab.mineralType == null || labInfo.lab.mineralType === labInfo.boost) {
          continue
        }
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(labInfo.lab, labInfo.lab.mineralType))
      }
    }
    return null
  }
}

