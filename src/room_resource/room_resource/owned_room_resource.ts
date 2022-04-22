import { Problem } from "application/problem"
import { V6Creep } from "prototype/creep"
import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { OwnedRoomInfo } from "room_resource/room_info"
import { Timestamp } from "utility/timestamp"
import type { TaskIdentifier } from "v5_task/task"
import { NormalRoomResource } from "./normal_room_resource"
import { OwnedRoomInfoAccessor } from "../room_info_accessor"

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

/**
 * 寿命は1tick
 */
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
    powerSpawn: StructurePowerSpawn | null
    factory: StructureFactory | null

    chargeableStructures: EnergyChargeableStructure[]
    researchLabs: ResearchLabs | null
  }

  public readonly walls: StructureWall[]
  public readonly ramparts: StructureRampart[]

  public roomInfoAccessor: OwnedRoomInfoAccessor

  public constructor(
    public readonly controller: StructureController,

    /** この部屋にいるMy creepsだけではなく、この部屋を親とするcreepsのリスト */
    private readonly ownedCreepInfo: OwnedRoomCreepInfo[],

    public readonly roomInfo: OwnedRoomInfo,
  ) {
    super(controller, roomInfo)

    this.roomInfoAccessor = new OwnedRoomInfoAccessor(controller.room, roomInfo, controller, this.sources, this.mineral?.mineralType ?? null)

    if (roomInfo.highestRcl < this.controller.level) {
      roomInfo.highestRcl = this.controller.level
    }

    const shouldCheckActiveness = this.controller.level < roomInfo.highestRcl
    const isActive = ((): (structure: AnyOwnedStructure) => boolean => {
      if (shouldCheckActiveness) {
        return structure => structure.isActive()
      }
      return () => true
    })()

    this.damagedStructures = []

    const spawns: StructureSpawn[] = []
    const extensions: StructureExtension[] = []
    const towers: StructureTower[] = []
    let storage = null as StructureStorage | null
    let terminal = null as StructureTerminal | null
    let extractor = null as StructureExtractor | null
    let observer = null as StructureObserver | null
    let powerSpawn = null as StructurePowerSpawn | null
    let factory = null as StructureFactory | null
    const chargeableStructures: EnergyChargeableStructure[] = []
    const researchLabs = ((): ResearchLabs | null => {
      if (roomInfo.researchLab == null) {
        return null
      }
      const inputLab1 = Game.getObjectById(roomInfo.researchLab.inputLab1)
      const inputLab2 = Game.getObjectById(roomInfo.researchLab.inputLab2)
      const outputLabs = roomInfo.researchLab.outputLabs.flatMap(id => Game.getObjectById(id) ?? [])
      if (inputLab1 == null || inputLab2 == null || outputLabs == null) {
        roomInfo.researchLab = undefined
        return null
      }
      if (shouldCheckActiveness === true) {
        if (isActive(inputLab1) !== true || isActive(inputLab2) !== true || outputLabs.some(lab => isActive(lab) !== true)) {
          roomInfo.researchLab = undefined
          return null
        }
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
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        spawns.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_EXTENSION:
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        extensions.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_TOWER:
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        towers.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_STORAGE:
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        storage = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_TERMINAL:
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        terminal = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_EXTRACTOR:
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        extractor = structure
        break
      case STRUCTURE_OBSERVER:
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        observer = structure
        break
      case STRUCTURE_POWER_SPAWN:
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        powerSpawn = structure
        break
      case STRUCTURE_FACTORY:
        if (structure.my !== true) {
          break
        }
        if (isActive(structure) !== true) {
          break
        }
        factory = structure
        break
      case STRUCTURE_WALL:
        this.walls.push(structure)
        break
      case STRUCTURE_RAMPART:
        if (structure.my !== true) {
          break
        }
        this.ramparts.push(structure)
        break
      default:
        break // TODO: 全て網羅する
      }
    })

    const chargeableLinks = ((): StructureLink[] => {
      if (roomInfo.config?.extraLinkIds == null) {
        return []
      }
      return roomInfo.config.extraLinkIds.flatMap(linkId => {
        const link = Game.getObjectById(linkId)
        if (link == null) {
          return []
        }
        if (link.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
          return []
        }
        return [link]
      })
    })()
    chargeableStructures.push(...chargeableLinks)

    if (chargeableStructures.length <= 0 && factory != null && factory.store.getUsedCapacity(RESOURCE_ENERGY) < 1000) {
      chargeableStructures.push(factory)
    }

    this.activeStructures = {
      spawns,
      extensions,
      towers,
      storage,
      terminal,
      extractor,
      observer,
      powerSpawn,
      factory,
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

  public getResourceAmount(resourceType: ResourceConstant): number {
    return (this.activeStructures.storage?.store.getUsedCapacity(resourceType) ?? 0)
      + (this.activeStructures.terminal?.store.getUsedCapacity(resourceType) ?? 0)
  }
}
