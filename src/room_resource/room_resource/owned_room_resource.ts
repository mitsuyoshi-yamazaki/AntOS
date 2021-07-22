import { Problem } from "application/problem"
import { V6Creep } from "prototype/creep"
import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { Timestamp } from "utility/timestamp"
import type { TaskIdentifier } from "v5_task/task"
import type { RoomInfo } from "world_info/room_info"
import { NormalRoomResource } from "./normal_room_resource"

export interface OwnedRoomCreepInfo {
  creep: V6Creep
  problems: Problem[]
}

export interface RunningCreepInfo {
  ticksToLive: Timestamp | null
  creepIdentifier: string | null
}

export class OwnedRoomResource extends NormalRoomResource {
  /** Decayed structureは含めない */
  public readonly damagedStructures: AnyStructure[]
  public readonly activeStructures: {
    spawns: StructureSpawn[]
    extensions: StructureExtension[]
    towers: StructureTower[]
    storage: StructureStorage | null
    terminal: StructureTerminal | null

    chargeableStructures: EnergyChargeableStructure[]
  }

  public readonly walls: StructureWall[]
  public readonly ramparts: StructureRampart[]

  public constructor(
    public readonly controller: StructureController,

    /** この部屋にいるMy creepsだけではなく、この部屋を親とするcreepsのリスト */
    private readonly ownedCreepInfo: OwnedRoomCreepInfo[],
    roomInfo: RoomInfo,
  ) {
    super(controller, roomInfo)

    this.damagedStructures = []

    const spawns: StructureSpawn[] = []
    const extensions: StructureExtension[] = []
    const towers: StructureTower[] = []
    let storage: StructureStorage | null = null
    let terminal: StructureTerminal | null = null
    const chargeableStructures: EnergyChargeableStructure[] = []

    this.walls = []
    this.ramparts = []

    const excludedDamagedStructureTypes: StructureConstant[] = [
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
      STRUCTURE_ROAD,
      STRUCTURE_CONTAINER,
    ]
    this.room.find(FIND_STRUCTURES).forEach(structure => {
      if (structure.isActive() !== true) {
        return
      }
      if (excludedDamagedStructureTypes.includes(structure.structureType) !== true && structure.hits < structure.hitsMax) {
        this.damagedStructures.push(structure)
      }

      switch (structure.structureType) {
      case STRUCTURE_SPAWN:
        spawns.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_EXTENSION:
        extensions.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_TOWER:
        towers.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_STORAGE:
        storage = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_TERMINAL:
        terminal = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_WALL:
        this.walls.push(structure)
        break
      case STRUCTURE_RAMPART:
        this.ramparts.push(structure)
        break
      default:
        break // TODO: 全て網羅する
      }
    })

    this.activeStructures = {
      spawns,
      extensions,
      towers,
      storage,
      terminal,
      chargeableStructures,
    }
  }

  // ---- Creep ---- //
  public runningCreepInfo(taskIdentifier: TaskIdentifier): RunningCreepInfo[] {
    return this.ownedCreepInfo
      .filter(info => info.creep.memory.i === taskIdentifier)
      .map(info => {
        return {
          ticksToLive: info.creep.ticksToLive ?? null,
          creepIdentifier: info.creep.memory.ci,
        }
      })
  }

  public idleCreeps(taskIdentifier: TaskIdentifier): OwnedRoomCreepInfo[] {
    return this.ownedCreepInfo
      .filter(info => {
        if (info.creep.memory.i !== taskIdentifier) {
          return false
        }
        if (info.creep.task != null) {
          return false
        }
        return true
      })
  }

  // ---- Resource ---- //
  public getSourceToAssign(position: RoomPosition): Source | null {
    if (this.sources.length <= 0) {
      return null
    }
    return this.sources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy().length
      const rTargetedBy = rhs.targetedBy().length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  public getEnergySource(position: RoomPosition): EnergySource | null { // TODO: Resource等は量も考慮する
    const energySources = this.energySources
    if (energySources.length <= 0) {
      return null
    }
    return energySources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy().length
      const rTargetedBy = rhs.targetedBy().length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  public getEnergyStore(position: RoomPosition): EnergyStore | null { // TODO: Resource等は量も考慮する
    if (this.activeStructures.storage != null && this.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 500) {
      return this.activeStructures.storage
    }
    if (this.activeStructures.terminal != null && this.activeStructures.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= 500) {
      return this.activeStructures.terminal
    }

    const energyStores = this.energyStores
    if (energyStores.length <= 0) {
      return null
    }

    return energyStores.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy().length
      const rTargetedBy = rhs.targetedBy().length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  public getStructureToCharge(position: RoomPosition): EnergyChargeableStructure | null {
    const chargeableStructures = this.activeStructures.chargeableStructures
    if (chargeableStructures.length <= 0) {
      return null
    }
    return chargeableStructures.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy().length
      const rTargetedBy = rhs.targetedBy().length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  public getConstructionSite(): ConstructionSite<BuildableStructureConstant> | null {
    return this.constructionSites[0]  // TODO: 優先順位づけ
  }

  public getRepairStructure(): AnyStructure | null {
    return this.damagedStructures[0]  // TODO: 優先順位づけ
  }
}
