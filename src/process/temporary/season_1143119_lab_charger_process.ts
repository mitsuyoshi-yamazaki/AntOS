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
import { isMineralBoostConstant, isResourceConstant } from "utility/resource"
import { RoomResources } from "room_resource/room_resources"
import { OwnedRoomInfo } from "room_resource/room_info"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("Season1143119LabChargerProcess", state => {
  return Season1143119LabChargerProcess.decode(state as Season1143119LabChargerProcessState)
})

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
  stopSpawning: boolean
}

export class Season1143119LabChargerProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  public get boosts(): MineralBoostConstant[] {
    return this.labStates.map(labState => labState.boost)
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly labStates: LabState[],
    private stopSpawning: boolean,
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
      stopSpawning: this.stopSpawning,
    }
  }

  public static decode(state: Season1143119LabChargerProcessState): Season1143119LabChargerProcess {
    return new Season1143119LabChargerProcess(state.l, state.i, state.parentRoomName, state.labStates, state.stopSpawning)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, labs: Season1143119LabChargerProcessLabInfo[]): Season1143119LabChargerProcess {
    const labStates: LabState[] = labs.map(labInfo => ({boost: labInfo.boost, labId: labInfo.lab.id}))
    return new Season1143119LabChargerProcess(Game.time, processId, parentRoomName, labStates, false)
  }

  public processShortDescription(): string {
    const numberOfCreeps = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const boostDescriptions: string[] = this.labStates.map(labState => coloredResourceType(labState.boost))
    return `${roomLink(this.parentRoomName)} ${numberOfCreeps}cr ${boostDescriptions.join(",")}`
  }

  public addBoost(boost: MineralBoostConstant, lab: StructureLab): void {
    if (this.labStates.some(labState => labState.boost === boost) === true) {
      PrimitiveLogger.programError(`${this.taskIdentifier} ${this.processId} boost ${coloredResourceType(boost)} is already in the list`)
      return
    }
    this.labStates.push({
      boost,
      labId: lab.id,
    })
  }

  public removeBoost(boost: MineralBoostConstant): void {
    const index = this.labStates.findIndex(labState => labState.boost === boost)
    if (index < 0) {
      PrimitiveLogger.programError(`${this.taskIdentifier} ${this.processId} boost ${coloredResourceType(boost)} is not in the list`)
      return
    }
    this.labStates.splice(index, 1)
  }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      return
    }
    if (resources.roomInfo.config?.boostLabs == null) {
      this.stopSpawning = true
    }
    const boostLabs = resources.roomInfo.config?.boostLabs ?? []

    const labs: Season1143119LabChargerProcessLabInfo[] = this.labStates.flatMap(labState => {
      const lab = Game.getObjectById(labState.labId)
      if (lab == null) {
        PrimitiveLogger.fatal(`${this.identifier} target lab ${labState.labId} not found ${roomLink(this.parentRoomName)}`)
        return []
      }
      if (boostLabs.includes(labState.labId) !== true) {
        this.stopSpawning = true
        return []
      }
      return {
        boost: labState.boost,
        lab,
      }
    })

    const terminal = resources.activeStructures.terminal
    if (terminal == null) {
      PrimitiveLogger.fatal(`${this.identifier} target terminal not found ${roomLink(this.parentRoomName)}`)
      return
    }

    const needResourceTransfer = ((): boolean => {
      for (const labInfo of labs) {
        if (terminal.store.getUsedCapacity(labInfo.boost) <= 0) {
          continue
        }
        if (labInfo.lab.mineralType != null && labInfo.lab.store.getFreeCapacity(labInfo.lab.mineralType) <= 0) {
          continue
        }
        return true
      }
      return false
    })()
    const shouldCollectResources = resources.roomInfo.config?.collectResources ?? false
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (creepCount < 1 && (needResourceTransfer === true || shouldCollectResources === true)) {
      this.requestCreep()
    }

    this.runCreep(terminal, labs, shouldCollectResources, resources.roomInfo)
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

  private runCreep(terminal: StructureTerminal, labs: Season1143119LabChargerProcessLabInfo[], shouldCollectResources: boolean, roomInfo: OwnedRoomInfo): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.creepTask(creep, terminal, labs, shouldCollectResources, roomInfo),
      () => true,
    )
  }

  private creepTask(creep: Creep, terminal: StructureTerminal, labs: Season1143119LabChargerProcessLabInfo[], shouldCollectResources: boolean, roomInfo: OwnedRoomInfo): CreepTask | null {
    if (creep.store.getUsedCapacity() <= 0 && creep.ticksToLive != null && creep.ticksToLive < 50) {
      creep.say("dying")
      return null
    }
    if (shouldCollectResources === true) {
      return this.collectResourceTask(creep, terminal, labs)
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

    const waitingPosition = ((): RoomPosition | null => {
      if (roomInfo.config?.waitingPosition == null) {
        return null
      }
      const { x, y } = roomInfo.config.waitingPosition
      try {
        return new RoomPosition(x, y, this.parentRoomName)
      } catch (e) {
        PrimitiveLogger.programError(`${this.identifier} cannot retrieve waiting position in ${roomLink(this.parentRoomName)}, ${x},${y}`)
        return null
      }
    })()
    if (waitingPosition != null && creep.pos.isEqualTo(waitingPosition) !== true) {
      return MoveToTask.create(waitingPosition, 0)
    }
    creep.say("boosted")
    return null
  }

  private collectResourceTask(creep: Creep, terminal: StructureTerminal, labs: Season1143119LabChargerProcessLabInfo[]): CreepTask | null {
    creep.say("collect")
    if (creep.store.getUsedCapacity() > 0) {
      const resourceType = Object.keys(creep.store)[0]
      if (resourceType != null && isResourceConstant(resourceType)) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, resourceType))
      }
      PrimitiveLogger.programError(`${this.identifier} ${resourceType} is not resource constant ${roomLink(this.parentRoomName)}`)
      return null
    }

    for (const labInfo of labs) {
      if (labInfo.lab.mineralType == null) {
        continue
      }
      if (labInfo.lab.store.getUsedCapacity(labInfo.lab.mineralType) <= 0) {
        continue
      }
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(labInfo.lab, labInfo.lab.mineralType))
    }
    creep.say("no mineral")
    return null
  }
}

