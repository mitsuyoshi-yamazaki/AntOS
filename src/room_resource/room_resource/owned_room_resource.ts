import { Problem } from "application/problem"
import { V6Creep } from "prototype/creep"
import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { OwnedRoomInfo } from "room_resource/room_info"
import { Timestamp } from "utility/timestamp"
import type { TaskIdentifier } from "v5_task/task"
import { NormalRoomResource } from "./normal_room_resource"

export type ResearchLabs = {
  inputLab1: StructureLab
  inputLab2: StructureLab
  outputLabs: StructureLab[]
}

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
    extractor: StructureExtractor | null
    observer: StructureObserver | null

    chargeableStructures: EnergyChargeableStructure[]
    researchLabs: ResearchLabs | null
  }

  public readonly walls: StructureWall[]
  public readonly ramparts: StructureRampart[]

  public constructor(
    public readonly controller: StructureController,

    /** この部屋にいるMy creepsだけではなく、この部屋を親とするcreepsのリスト */
    private readonly ownedCreepInfo: OwnedRoomCreepInfo[],
    public readonly roomInfo: OwnedRoomInfo,
  ) {
    super(controller, roomInfo)

    this.damagedStructures = []

    const spawns: StructureSpawn[] = []
    const extensions: StructureExtension[] = []
    const towers: StructureTower[] = []
    let storage: StructureStorage | null = null
    let terminal: StructureTerminal | null = null
    let extractor: StructureExtractor | null = null
    let observer: StructureObserver | null = null
    const chargeableStructures: EnergyChargeableStructure[] = []
    const researchLabs = ((): ResearchLabs | null => {
      if (roomInfo.researchLab == null) {
        return null
      }
      const inputLab1 = Game.getObjectById(roomInfo.researchLab.inputLab1)
      const inputLab2 = Game.getObjectById(roomInfo.researchLab.inputLab2)
      const outputLabs = roomInfo.researchLab.outputLabs.flatMap(id => Game.getObjectById(id) ?? [])
      if (inputLab1 == null || inputLab2 == null || outputLabs.length <= 0) {
        roomInfo.researchLab = undefined
        return null
      }
      if (inputLab1.isActive() !== true || inputLab2.isActive() !== true || outputLabs.some(lab => lab.isActive() !== true)) {
        roomInfo.researchLab = undefined
        return null
      }
      return {
        inputLab1,
        inputLab2,
        outputLabs,
      }
    })()

    this.walls = []
    this.ramparts = []

    const excludedDamagedStructureTypes: StructureConstant[] = [
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
      STRUCTURE_ROAD,
      STRUCTURE_CONTAINER,
    ]
    this.room.find(FIND_STRUCTURES).forEach(structure => {
      if (excludedDamagedStructureTypes.includes(structure.structureType) !== true && structure.hits < structure.hitsMax) {
        this.damagedStructures.push(structure)
      }

      switch (structure.structureType) {
      case STRUCTURE_SPAWN:
        if (structure.isActive() !== true) {
          break
        }
        spawns.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_EXTENSION:
        if (structure.isActive() !== true) {
          break
        }
        extensions.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_TOWER:
        if (structure.isActive() !== true) {
          break
        }
        towers.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_STORAGE:
        if (structure.isActive() !== true) {
          break
        }
        storage = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_TERMINAL:
        if (structure.isActive() !== true) {
          break
        }
        terminal = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_EXTRACTOR:
        if (structure.isActive() !== true) {
          break
        }
        extractor = structure
        break
      case STRUCTURE_OBSERVER:
        if (structure.isActive() !== true) {
          break
        }
        observer = structure
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
      extractor,
      observer,
      chargeableStructures,
      researchLabs,
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
      const lTargetedBy = lhs.pos.targetedBy("harvest").taskRunnerInfo.length
      const rTargetedBy = rhs.pos.targetedBy("harvest").taskRunnerInfo.length
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
      const lTargetedBy = lhs.pos.targetedBy("withdraw").taskRunnerInfo.length
      const rTargetedBy = rhs.pos.targetedBy("withdraw").taskRunnerInfo.length
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
      const lTargetedBy = lhs.pos.targetedBy("withdraw").taskRunnerInfo.length
      const rTargetedBy = rhs.pos.targetedBy("withdraw").taskRunnerInfo.length
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
      const lTargetedBy = lhs.pos.targetedBy("transfer").taskRunnerInfo.length
      const rTargetedBy = rhs.pos.targetedBy("transfer").taskRunnerInfo.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  public getConstructionSite(): ConstructionSite<BuildableStructureConstant> | null {
    return this.constructionSites[0] ?? null  // TODO: 優先順位づけ
  }

  public getRepairStructure(): AnyStructure | null {
    return this.damagedStructures[0] ?? null  // TODO: 優先順位づけ
  }
}
