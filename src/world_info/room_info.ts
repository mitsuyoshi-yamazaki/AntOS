import { RoomName, RoomPathMemory } from "prototype/room"
import { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { calculateSourceRoute } from "script/pathfinder"
// Worldをimportしない

const allVisibleRooms: Room[] = []
const ownedRooms: Room[] = []
const ownedRoomObjects = new Map<RoomName, OwnedRoomObjects>()

export interface RoomsInterface {
  // ---- Lifecycle ---- //
  beforeTick(creeps: Map<RoomName, Creep[]>): OwnedRoomObjects[]
  afterTick(): void

  // ---- Function ---- //
  get(roomName: RoomName): Room | null
  getAllOwnedRooms(): Room[]
  getAllOwnedRoomObjects(): OwnedRoomObjects[]
  getOwnedRoomObjects(roomName: RoomName): OwnedRoomObjects | null
}

export const Rooms: RoomsInterface = {
  // ---- Lifecycle ---- //
  beforeTick: function (creeps: Map<RoomName, Creep[]>): OwnedRoomObjects[] {
    allVisibleRooms.splice(0, allVisibleRooms.length)
    ownedRooms.splice(0, ownedRooms.length)
    ownedRoomObjects.clear()

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName]
      allVisibleRooms.push(room)

      if (room.controller != null && room.controller.my === true) {
        ownedRooms.push(room)
        ownedRoomObjects.set(roomName, enumerateObjects(room.controller, creeps.get(roomName) ?? []))
      }
    }

    return Array.from(ownedRoomObjects.values())
  },

  afterTick: function (): void {
  },

  // ---- Function ---- //
  get: function (roomName: RoomName): Room | null {
    return Game.rooms[roomName]
  },

  getAllOwnedRooms: function (): Room[] {
    return ownedRooms.concat([])
  },

  getAllOwnedRoomObjects: function (): OwnedRoomObjects[] {
    return Array.from(ownedRoomObjects.values())
  },

  getOwnedRoomObjects: function(roomName: RoomName): OwnedRoomObjects | null {
    return ownedRoomObjects.get(roomName) ?? null
  },
}

// ---- Function ---- //
function enumerateObjects(controller: StructureController, creeps: Creep[]): OwnedRoomObjects {
  return new OwnedRoomObjects(controller, creeps)
}

export class OwnedRoomObjects {
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
  public readonly droppedResources: Resource[]
  public readonly tombStones: Tombstone[]
  public readonly energySources: EnergySource[]
  public readonly energyStores: EnergyStore[] // TODO: Creepも含める
  public readonly flags: Flag[]

  public constructor(
    public readonly controller: StructureController,
    creeps: Creep[],
  ) {
    const room = controller.room

    this.sources = room.find(FIND_SOURCES)
    this.constructionSites = room.find(FIND_MY_CONSTRUCTION_SITES)
    this.droppedResources = room.find(FIND_DROPPED_RESOURCES)
    this.tombStones = room.find(FIND_TOMBSTONES)
    this.flags = room.find(FIND_FLAGS)

    this.energySources = this.tombStones.filter(tombStone => tombStone.store.getUsedCapacity(RESOURCE_ENERGY) > 50)
    this.energySources.push(...this.droppedResources.filter(resource => resource.resourceType === RESOURCE_ENERGY))

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
    let storage: StructureStorage | null = null
    let terminal: StructureTerminal | null = null
    const chargeableStructures: EnergyChargeableStructure[] = []

    const excludedDamagedStructureTypes: StructureConstant[] = [
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
      STRUCTURE_ROAD,
      STRUCTURE_CONTAINER,
    ]
    const myStructures = room.find(FIND_STRUCTURES)
    myStructures.forEach(structure => {
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
      case STRUCTURE_CONTAINER:
        if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          this.energySources.push(structure)
          this.energyStores.push(structure)
        }
        checkDecayed(structure)
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
      case STRUCTURE_ROAD:
        checkDecayed(structure)
        break
      default:
        break // TODO: 全て網羅する
      }
    })

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

    if (spawns[0] != null) {
      calculateSourceRouteIn(room, this.sources, spawns[0].pos)
    } else {
      const spawnConstructionSite = this.constructionSites.find(site => site.structureType === STRUCTURE_SPAWN)
      if (spawnConstructionSite != null) {
        calculateSourceRouteIn(room, this.sources, spawnConstructionSite.pos)
      }
    }

    this.activeStructures = {
      spawns,
      extensions,
      towers,
      storage,
      terminal,
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
  }

  public getSource(position: RoomPosition): Source | null {
    if (this.sources.length <= 0) {
      return null
    }
    return this.sources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
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
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
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
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
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
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
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

function calculateSourceRouteIn(room: Room, sources: Source[], destination: RoomPosition): void {
  const pathInMemory: RoomPathMemory = room.memory.p ?? { s: {} }
  if (room.memory.p == null) {
    room.memory.p = pathInMemory
  }

  sources.forEach(source => {
    const sourcePath = pathInMemory.s[source.id]
    if (sourcePath === "no path") {
      return
    }
    if (sourcePath != null) {
      return
    }
    const result = calculateSourceRoute(source.id, destination)
    switch (result.resultType) {
    case "succeeded": {
      const path = result.value.path.path
        .map(position => ({ x: position.x, y: position.y }))
        .splice(3, result.value.path.path.length - 3)
      path.push(...result.value.harvestPositions.map(position => ({ x: position.x, y: position.y })))
      pathInMemory.s[source.id] = {
        p: path,
        d: { x: destination.x, y: destination.y },
      }
      console.log(`source path calculated with ${result.value.harvestPositions.length} harvest position`)
      break
    }
    case "failed":
      pathInMemory.s[source.id] = "no path"
      console.log(`source path cannot found: ${result.reason}`)
      break
    }
  })
}
