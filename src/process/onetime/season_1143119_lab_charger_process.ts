import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, roomLink } from "utility/log"
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
import { isMineralBoostConstant } from "utility/resource"

export type Season1143119LabChargerProcessLabInfo = {
  boost: MineralBoostConstant
  lab: StructureLab
}

type LabState = {
  boost: MineralBoostConstant
  labId: Id<StructureLab>
}

export interface Season1143119LabChargerProcessState extends ProcessState {
  parentRoomName: RoomName
  labStates: LabState[]
}

// Game.io("launch -l Season1143119LabChargerProcess room_name=W14S28 labs=61011ce4706bd898698bc8dc:XZHO2,6101e0c67c1295e98c0ff933:XLHO2,6102750e8f86f5cb23f3328c:KHO2,61025016e69a6a6dcc642732:XGHO2,6101c18256c819be8be26aca:XZH2O")

// 3Towers full boosted ranged attacker
// Game.io("launch -l Season1143119LabChargerProcess room_name=W9S24 labs=60f967be396ad538632751b5:XZHO2,60f92938993e4f921d6487aa:XKHO2,6106ee55706bd84a378e1ee7:XLHO2,61073ced8f86f51bf3f51e78:XGHO2")

// tier3 4towers dismantler
// Game.io("launch -l Season1143119LabChargerProcess room_name=W21S23 labs=61085d0c464512bdf3c72008:XZHO2,61084244e3f522438c8577a0:XZH2O,610836368631b6143cd4cd0c:XLHO2,610d21b256c81947c9e72d78:XKHO2,610d4472e3f5226d9687a54c:XGHO2")
export class Season1143119LabChargerProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly labStates: LabState[],
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1143119LabChargerProcessState {
    return {
      t: "Season1143119LabChargerProcess",
      l: this.launchTime,
      i: this.processId,
      parentRoomName: this.parentRoomName,
      labStates: this.labStates,
    }
  }

  public static decode(state: Season1143119LabChargerProcessState): Season1143119LabChargerProcess {
    return new Season1143119LabChargerProcess(state.l, state.i, state.parentRoomName, state.labStates)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, labs: Season1143119LabChargerProcessLabInfo[]): Season1143119LabChargerProcess {
    const labStates: LabState[] = labs.map(labInfo => ({boost: labInfo.boost, labId: labInfo.lab.id}))
    return new Season1143119LabChargerProcess(Game.time, processId, parentRoomName, labStates)
  }

  public processShortDescription(): string {
    const numberOfCreeps = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const boostDescriptions: string[] = this.labStates.map(labState => coloredResourceType(labState.boost))
    return `${roomLink(this.parentRoomName)} ${numberOfCreeps}cr ${boostDescriptions.join(",")}`
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      return
    }

    const labs: Season1143119LabChargerProcessLabInfo[] = this.labStates.flatMap(labState => {
      const lab = Game.getObjectById(labState.labId)
      if (lab == null) {
        PrimitiveLogger.fatal(`${this.identifier} target lab ${labState.labId} not found ${roomLink(this.parentRoomName)}`)
        return []
      }
      return {
        boost: labState.boost,
        lab,
      }
    })

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
      body: [CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runCreep(terminal: StructureTerminal, labs: Season1143119LabChargerProcessLabInfo[]): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.creepTask(creep, terminal, labs),
      () => true,
    )
  }

  private creepTask(creep: Creep, terminal: StructureTerminal, labs: Season1143119LabChargerProcessLabInfo[]): CreepTask | null {
    if (creep.store.getUsedCapacity() <= 0 && creep.ticksToLive != null && creep.ticksToLive < 50) {
      return null
    }

    if (creep.store.getUsedCapacity() > 0) {
      const resourceType = Object.keys(creep.store)[0] as ResourceConstant | null
      if (resourceType != null && labs.every(l => l.boost !== resourceType)) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, resourceType))
      }
    }

    if (creep.store.getUsedCapacity() <= 0) {
      const container = creep.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } }).find(container => {
        if (!(container instanceof StructureContainer)) {
          return false
        }
        if (container.store.getUsedCapacity() === container.store.getUsedCapacity(RESOURCE_ENERGY)) {
          return false
        }
        const resourceType = Object.keys(container.store)[0] as ResourceConstant | null
        if (resourceType == null || !isMineralBoostConstant(resourceType)) {
          return false
        }
        return true
      }) as StructureContainer | null
      if (container != null) {
        const resourceType = Object.keys(container.store)[0] as ResourceConstant | null
        if (resourceType != null && isMineralBoostConstant(resourceType)) {
          return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(container, resourceType))
        }
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

