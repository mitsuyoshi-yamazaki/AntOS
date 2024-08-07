import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { Environment } from "utility/environment"
import { roomLink } from "utility/log"
import { Migration } from "utility/migration"
import { ShortVersion } from "shared/utility/system_info"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import type { RoomName } from "shared/utility/room_name_types"
import { roomSectorNameOf } from "utility/room_coordinate"
// Worldをimportしない

const allVisibleRooms: Room[] = []
const ownedRooms: Room[] = []
const ownedRoomObjects = new Map<RoomName, OwnedRoomObjects>()

// Memoryに入れずにオンメモリキャッシュでもワークするはず
export interface RoomInfoMemory {
  /** version */
  v: ShortVersion

  /** energySourceStructures */
  src: Id<EnergySource>[]

  /** energyStoreStructures */
  str: Id<EnergyStore>[]

  /** upgrader */
  u: {
    /** container id */
    c: Id<StructureContainer> | null
  } | null

  bootstrapping: boolean
  highestRcl: number
}

export interface RoomInfo {
  version: ShortVersion

  energySourceStructures: EnergySource[]
  energyStoreStructures: EnergyStore[]

  /** @deprecated */
  upgrader: {
    container: StructureContainer | null
  } | null

  bootstrapping: boolean
  highestRcl: number
}

export interface RoomsInterface {
  // ---- Lifecycle ---- //
  beforeTick(): OwnedRoomObjects[]
  afterTick(): void

  // ---- Get Rooms ---- //
  get(roomName: RoomName): Room | null
  getAllOwnedRooms(): Room[]

  // ---- Get RoomObjects ---- //
  getAllOwnedRoomObjects(): OwnedRoomObjects[]
  getOwnedRoomObjects(roomName: RoomName): OwnedRoomObjects | null
}

export const Rooms: RoomsInterface = {
  // ---- Lifecycle ---- //
  beforeTick: function (): OwnedRoomObjects[] {
    allVisibleRooms.splice(0, allVisibleRooms.length)
    ownedRooms.splice(0, ownedRooms.length)
    ownedRoomObjects.clear()

    const roomVersions = new Map<ShortVersion, StructureController[]>()

    Object.entries(Game.rooms).forEach(([roomName, room]) => {
      allVisibleRooms.push(room)

      if (room.controller != null && room.controller.my === true && Memory.v3.rooms.includes(roomName) === true && Memory.ignoreRooms.includes(roomName) !== true) {
        ownedRooms.push(room)
        ownedRoomObjects.set(roomName, enumerateObjects(room.controller))

        const controlVersion = Migration.roomVersion(room.name)
        const rooms = ((): StructureController[] => {
          const stored = roomVersions.get(controlVersion)
          if (stored != null) {
            return stored
          }
          const newRooms: StructureController[] = []
          roomVersions.set(controlVersion, newRooms)
          return newRooms
        })()
        rooms.push(room.controller)
      }
    })

    if (Game.time % 107 === 13) {
      const detailedRoomLink = ((controller: StructureController): string => {
        if (controller.level >= 8) {
          return roomLink(controller.room.name)
        }
        const progress = Math.floor((controller.progress / controller.progressTotal) * 10)
        return `${roomLink(controller.room.name)}(${controller.level}.${progress})`
      })

      roomVersions.forEach((controllers, version) => {
        if (controllers.length <= 6) {
          PrimitiveLogger.log(`${controllers.length} ${version} rooms: ${controllers.map(controller => detailedRoomLink(controller)).join(", ")}`)
          return
        }
        const sectors = new ValuedArrayMap<string, StructureController>()
        controllers.forEach(controller => {
          const roomName = controller.room.name
          const sectorName = roomSectorNameOf(roomName)
          if (sectorName == null) {
            PrimitiveLogger.programError(`Cannot get sector name of ${roomLink(roomName)}`)
            return
          }
          sectors.getValueFor(sectorName).push(controller)
        })
        PrimitiveLogger.log(`${controllers.length} ${version} rooms:\n${Array.from(sectors.entries()).map(([sectorName, controllersInSector]) => `- ${sectorName}: ${controllersInSector.map(controller => detailedRoomLink(controller)).join(", ")}`).join("\n")}`)
      })
    }

    return Array.from(ownedRoomObjects.values())
  },

  afterTick: function (): void {
    saveRoomInfo()
  },

  // ---- Get Rooms ---- //
  get: function (roomName: RoomName): Room | null {
    return Game.rooms[roomName] ?? null
  },

  getAllOwnedRooms: function (): Room[] {
    return ownedRooms.concat([])
  },

  // ---- Get RoomObjects ---- //
  getAllOwnedRoomObjects: function (): OwnedRoomObjects[] {
    return Array.from(ownedRoomObjects.values())
  },

  getOwnedRoomObjects: function(roomName: RoomName): OwnedRoomObjects | null {
    return ownedRoomObjects.get(roomName) ?? null
  },
}

// ---- Function ---- //
function enumerateObjects(controller: StructureController): OwnedRoomObjects {
  return new OwnedRoomObjects(controller)
}

export class OwnedRoomObjects {
  public readonly roomInfo: RoomInfo

  public readonly sources: Source[]
  public readonly constructionSites: ConstructionSite<BuildableStructureConstant>[] // TODO: 優先順位づけ等

  /** Decayed structureは含めない */
  public readonly damagedStructures: AnyStructure[]
  public readonly decayedStructures: AnyStructure[]
  public readonly activeStructures: {
    spawns: StructureSpawn[]
    extensions: StructureExtension[]
    towers: StructureTower[]
    storage: StructureStorage | null
    terminal: StructureTerminal | null
    powerSpawn: StructurePowerSpawn | null

    chargeableStructures: EnergyChargeableStructure[]
  }
  public readonly hostiles: {
    creeps: Creep[]
    powerCreeps: PowerCreep[]
  }
  public readonly alliances: {
    creeps: Creep[]
    powerCreeps: PowerCreep[]
  }
  public readonly damagedCreeps: AnyCreep[]
  public readonly droppedResources: Resource[]
  public readonly tombStones: Tombstone[]
  public readonly energySources: EnergySource[]
  public readonly energyStores: EnergyStore[] // TODO: Creepも含める
  public readonly flags: Flag[]

  public constructor(
    public readonly controller: StructureController,
  ) {
    const room = controller.room

    const roomInfoMemory = Memory.room_info[room.name]
    this.roomInfo = ((): RoomInfo => {
      if (roomInfoMemory == null) { // 新規のRoomの場合
        return {
          version: ShortVersion.v5,
          energySourceStructures: [],
          energyStoreStructures: [],
          upgrader: null,
          bootstrapping: false,
          highestRcl: controller.level,
        }
      }
      return decodeRoomInfo(roomInfoMemory)
    })()

    if (this.roomInfo.highestRcl < this.controller.level) {
      this.roomInfo.highestRcl = this.controller.level
    }
    const shouldCheckActiveness = this.controller.level < this.roomInfo.highestRcl

    this.sources = room.find(FIND_SOURCES)
    this.constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES)
    this.droppedResources = room.find(FIND_DROPPED_RESOURCES)
    this.tombStones = room.find(FIND_TOMBSTONES)
    this.flags = room.find(FIND_FLAGS)

    this.energySources = [] //this.tombStones.filter(tombStone => tombStone.store.getUsedCapacity(RESOURCE_ENERGY) > 50)
    // this.energySources.push(...this.droppedResources.filter(resource => resource.resourceType === RESOURCE_ENERGY))

    this.energyStores = this.energySources.concat([])
    // this.energyStores.push(...this.tombStones.filter(tombStone => tombStone.store.getUsedCapacity(RESOURCE_ENERGY) > 0)) // TODO: Creepを含められるようにする: 互いに食い合わないようにする
    // const energyStoreCreeps = creeps.filter(creep => {
    //   if (!isV5CreepMemory(creep.memory)) {
    //     return false
    //   }
    //   if (hasNecessaryRoles(creep, [CreepRole.EnergyStore]) !== true) {
    //     return false
    //   }
    //   return creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0
    // })
    // this.energyStores.push(...energyStoreCreeps)

    this.damagedStructures = []
    this.decayedStructures = [] // TODO: rampartを含める
    const checkDecayed = ((structure: AnyStructure): void => {
      if (structure.hits < structure.hitsMax * 0.6) {
        this.decayedStructures.push(structure)
      }
    })

    const spawns: StructureSpawn[] = []
    const extensions: StructureExtension[] = []
    const towers: StructureTower[] = []
    let storage = null as StructureStorage | null
    let terminal = null as StructureTerminal | null
    let powerSpawn: StructurePowerSpawn | null = null
    const chargeableLabs: StructureLab[] = []
    let nuker = null as StructureNuker | null

    const chargeableStructures: EnergyChargeableStructure[] = []
    if (this.roomInfo.upgrader?.container != null) {
      const upgraderContainer = this.roomInfo.upgrader.container
      if (upgraderContainer.store.getFreeCapacity(RESOURCE_ENERGY) > upgraderContainer.store.getCapacity() * 0.3) {
        chargeableStructures.push(upgraderContainer)
      }
    }

    const excludedDamagedStructureTypes: StructureConstant[] = [
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
      STRUCTURE_ROAD,
      STRUCTURE_CONTAINER,
    ]
    const myStructures = room.find(FIND_STRUCTURES)
    myStructures.forEach(structure => {
      if (excludedDamagedStructureTypes.includes(structure.structureType) !== true && structure.hits < structure.hitsMax) {
        this.damagedStructures.push(structure)
      }

      switch (structure.structureType) {
      case STRUCTURE_SPAWN:
        if (structure.my !== true) {
          break
        }
        if (shouldCheckActiveness === true && structure.isActive() !== true) {
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
        // activeでないExtensionを使用するバグがあるため
        // https://discord.com/channels/860665589738635336/864238310058754069/888294594977071134
        // if (shouldCheckActiveness === true && structure.isActive() !== true) {
        //   break
        // }
        extensions.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_TOWER:
        if (structure.my !== true) {
          break
        }
        if (shouldCheckActiveness === true && structure.isActive() !== true) {
          break
        }
        towers.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 50) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_CONTAINER:
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 300) {
          if (structure !== this.roomInfo.upgrader?.container) {
            this.energySources.push(structure)
            this.energyStores.push(structure)
          }
        }
        checkDecayed(structure)
        break
      case STRUCTURE_STORAGE:
        if (structure.my !== true) {
          break
        }
        if (shouldCheckActiveness === true && structure.isActive() !== true) {
          break
        }
        storage = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 1000) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_TERMINAL:
        if (structure.my !== true) {
          break
        }
        if (shouldCheckActiveness === true && structure.isActive() !== true) {
          break
        }
        terminal = structure
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 20000) {
          this.energyStores.push(structure)
        }
        break
      case STRUCTURE_POWER_SPAWN:
        if (structure.my !== true) {
          break
        }
        if (shouldCheckActiveness === true && structure.isActive() !== true) {
          break
        }
        powerSpawn = structure
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 2000) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_LAB:
        if (structure.my !== true) {
          break
        }
        if (shouldCheckActiveness === true && structure.isActive() !== true) {
          break
        }
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableLabs.push(structure)
        }
        break
      case STRUCTURE_NUKER:
        if (structure.my !== true) {
          break
        }
        if (shouldCheckActiveness === true && structure.isActive() !== true) {
          break
        }
        nuker = structure
        break
      case STRUCTURE_ROAD:
        checkDecayed(structure)
        break
      default:
        break // TODO: 全て網羅する
      }
    })

    if (chargeableStructures.length < 12) {
      const chargeableLinks = ((): StructureLink[] => {
        const roomInfoMemory = Memory.v6RoomInfo[room.name]
        if (roomInfoMemory?.roomType !== "owned") {
          return []
        }
        const extraLinkIds = roomInfoMemory.config?.extraLinkIds
        if (extraLinkIds == null) {
          return []
        }
        return extraLinkIds.flatMap(linkId => {
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
    }

    // Distributorで行う
    // if (chargeableStructures.length <= 0) {
    //   if (terminal != null && (room.storage != null && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 50000)) {
    //     if (terminal.store.getFreeCapacity() > 30000) {
    //       if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
    //         chargeableStructures.push(terminal)
    //       } else if (controller.level >= 8 && room.storage != null && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 150000) {
    //         chargeableStructures.push(terminal)
    //       }
    //     }
    //   }
    // }
    // if (chargeableStructures.length <= 0) {
    chargeableStructures.push(...chargeableLabs)
    // }

    const totalEnergyAmount = (storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) + (terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
    if (chargeableStructures.length <= 0 && nuker != null && nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && totalEnergyAmount > 100000) {
      chargeableStructures.push(nuker)
    }

    const othersCreeps = room.find(FIND_HOSTILE_CREEPS)
    const othersPowerCreeps = room.find(FIND_HOSTILE_POWER_CREEPS)
    const hostileCreeps: Creep[] = []
    const hostilePowerCreeps: PowerCreep[] = []
    const allianceCreeps: Creep[] = []
    const alliancePowerCreeps: PowerCreep[] = []

    othersCreeps.forEach(creep => {
      if (Game.isEnemy(creep.owner)) {
        hostileCreeps.push(creep)
      } else {
        allianceCreeps.push(creep)
      }
    })
    othersPowerCreeps.forEach(powerCreep => {
      if (Game.isEnemy(powerCreep.owner)) {
        hostilePowerCreeps.push(powerCreep)
      } else {
        alliancePowerCreeps.push(powerCreep)
      }
    })

    this.activeStructures = {
      spawns,
      extensions,
      towers,
      storage,
      terminal,
      powerSpawn,
      chargeableStructures,
    }

    this.hostiles = {
      creeps: hostileCreeps,
      powerCreeps: hostilePowerCreeps,
    }
    this.alliances = {
      creeps: allianceCreeps,
      powerCreeps: alliancePowerCreeps,
    }

    this.damagedCreeps = room.find(FIND_MY_CREEPS).filter(creep => creep.hits < creep.hitsMax)
    this.damagedCreeps.push(...room.find(FIND_MY_POWER_CREEPS).filter(creep => creep.hits < creep.hitsMax))
  }

  public getSource(position: RoomPosition): Source | null {
    const sources = this.sources.filter(source => source.energy > 0 || (source.ticksToRegeneration != null && source.ticksToRegeneration < 20))
    if (sources.length <= 0) {
      return null
    }
    return sources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.v5TargetedBy.length
      const rTargetedBy = rhs.v5TargetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  public getEnergySource(position: RoomPosition): EnergySource | null { // TODO: Resource等は量も考慮する
    let energySources = this.energySources
    if (this.controller.room.name === "W47S2" && Environment.world === "persistent world" && Environment.shard === "shard2") { // FixMe:
      energySources = energySources.filter(source => {
        if (source.pos.x <= 1) {
          return false
        }
        return true
      })
    }

    if (energySources.length <= 0) {
      return null
    }
    return energySources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.v5TargetedBy.length
      const rTargetedBy = rhs.v5TargetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  public getEnergyStore(position: RoomPosition, options?: { ignoreDroppedResources?: boolean }): EnergyStore | null { // TODO: Resource等は量も考慮する
    const roomInfo = Memory.v6RoomInfo[this.controller.room.name]
    if (roomInfo != null && roomInfo.roomType === "owned") {
      if (roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] != null) {
        if (this.activeStructures.terminal != null && this.activeStructures.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= 500) {
          if (this.activeStructures.storage != null && this.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 300000) {
            return this.activeStructures.terminal
          }
        }
      }
    }
    if (this.activeStructures.storage != null && this.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 500) {
      return this.activeStructures.storage
    }
    if (this.activeStructures.terminal != null && this.activeStructures.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= 500) {
      return this.activeStructures.terminal
    }

    if (options?.ignoreDroppedResources === true) {
      return null
    }

    const energyStores = this.energyStores
    if (energyStores.length <= 0) {
      return null
    }

    return energyStores.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.v5TargetedBy.length
      const rTargetedBy = rhs.v5TargetedBy.length
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
      const lTargetedBy = lhs.v5TargetedBy.length
      const rTargetedBy = rhs.v5TargetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  public getConstructionSite(position: RoomPosition): ConstructionSite<BuildableStructureConstant> | null {
    const wallTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
    return position.findClosestByPath(this.constructionSites.filter(site => wallTypes.includes(site.structureType) !== true))  // TODO: 優先順位づけ
  }

  public getRepairStructure(): AnyStructure | null {
    return this.damagedStructures[0] ?? null  // TODO: 優先順位づけ
  }
}

export function decodeRoomInfo(roomInfoMemory: RoomInfoMemory): RoomInfo {
  return {
    version: roomInfoMemory.v,

    energySourceStructures: roomInfoMemory.src?.flatMap(id => Game.getObjectById(id) ?? []) ?? [],
    energyStoreStructures: roomInfoMemory.str?.flatMap(id => Game.getObjectById(id) ?? []) ?? [],

    upgrader: (() => {
      if (roomInfoMemory == null || roomInfoMemory.u == null) {
        return null
      }
      const container = (() => {
        if (roomInfoMemory.u.c == null) {
          return null
        }
        const stored = Game.getObjectById(roomInfoMemory.u.c)
        if (stored == null) {
          roomInfoMemory.u.c = null
          return null
        }
        return stored
      })()
      return {
        container,
      }
    })(),

    bootstrapping: roomInfoMemory.bootstrapping ?? false,
    highestRcl: roomInfoMemory.highestRcl ?? 1,
  }
}

function encodeRoomInfo(roomInfo: RoomInfo): RoomInfoMemory {
  return {
    v: roomInfo.version,
    src: roomInfo.energySourceStructures.map(obj => obj.id),
    str: roomInfo.energyStoreStructures.map(obj => obj.id),
    u: (() => {
      if (roomInfo.upgrader == null) {
        return null
      }
      return {
        c: roomInfo.upgrader.container?.id ?? null,
      }
    })(),
    bootstrapping: roomInfo.bootstrapping,
    highestRcl: roomInfo.highestRcl,
  }
}

function saveRoomInfo(): void {
  ownedRoomObjects.forEach((objects, roomName) => {
    Memory.room_info[roomName] = encodeRoomInfo(objects.roomInfo)
  })
}
