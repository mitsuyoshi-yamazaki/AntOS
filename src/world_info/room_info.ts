import { CreepRole, hasNecessaryRoles, isV5CreepMemory } from "prototype/creep"
import { RoomName, RoomPathMemory } from "prototype/room"
import { EnergyChargeableStructure, EnergyStore } from "prototype/room_object"
import { calculateSourceRoute } from "script/pathfinder"
// Worldをimportしない

export interface OwnedRoomObjects {
  controller: StructureController
  sources: Source[]
  constructionSites: ConstructionSite<BuildableStructureConstant>[] // TODO: 優先順位づけ等
  damagedStructures: AnyStructure[]
  activeStructures: {
    spawns: StructureSpawn[]
    extensions: StructureExtension[]
    towers: StructureTower[]

    chargeableStructures: EnergyChargeableStructure[]
  }
  hostiles: {
    creeps: Creep[]
    powerCreeps: PowerCreep[]
  }
  alliances: {
    creeps: Creep[]
    powerCreeps: PowerCreep[]
  }
  droppedResources: Resource[]
  tombStones: Tombstone[]
  energyStores: EnergyStore[] // TODO: Creepも含める
  flags: Flag[]
}

const allVisibleRooms: Room[] = []
const ownedRoomObjects = new Map<RoomName, OwnedRoomObjects>()

export interface RoomsInterface {
  // ---- Lifecycle ---- //
  beforeTick(creeps: Map<RoomName, Creep[]>): Room[]
  afterTick(): void

  // ---- Function ---- //
  get(roomName: RoomName): Room | null
  getAllOwnedRoomObjects(): OwnedRoomObjects[]
  getOwnedRoomObjects(roomName: RoomName): OwnedRoomObjects | null
}

export const Rooms: RoomsInterface = {
  // ---- Lifecycle ---- //
  beforeTick: function (creeps: Map<RoomName, Creep[]>): Room[] {
    allVisibleRooms.splice(0, allVisibleRooms.length)
    ownedRoomObjects.clear()

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName]
      allVisibleRooms.push(room)

      if (room.controller != null && room.controller.my === true) {
        ownedRoomObjects.set(roomName, enumerateObjects(room.controller, creeps.get(roomName) ?? []))
      }
    }

    return allVisibleRooms.concat([])
  },

  afterTick: function (): void {

  },

  // ---- Function ---- //
  get: function (roomName: RoomName): Room | null {
    return Game.rooms[roomName]
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
  const room = controller.room

  const sources = room.find(FIND_SOURCES)
  const spawns: StructureSpawn[] = []
  const extensions: StructureExtension[] = []
  const towers: StructureTower[] = []
  const damagedStructures: AnyStructure[] = []
  const chargeableStructures: EnergyChargeableStructure[] = []
  const constructionSites: ConstructionSite<BuildableStructureConstant>[] = room.find(FIND_MY_CONSTRUCTION_SITES)
  const droppedResources = room.find(FIND_DROPPED_RESOURCES)
  const tombStones = room.find(FIND_TOMBSTONES)
  const energyStores: EnergyStore[] = []

  energyStores.push(...droppedResources.filter(resource => resource.resourceType === RESOURCE_ENERGY))
  energyStores.push(...tombStones.filter(tombStone => tombStone.store.getUsedCapacity(RESOURCE_ENERGY) > 0))
  const energyStoreCreeps = creeps.filter(creep => {
    if (!isV5CreepMemory(creep.memory)) {
      return false
    }
    if (hasNecessaryRoles(creep, [CreepRole.EnergyStore]) !== true) {
      return false
    }
    return creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0
  })
  energyStores.push(...energyStoreCreeps)

  const flags = room.find(FIND_FLAGS)

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
      damagedStructures.push(structure)
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
        energyStores.push(structure)
      }
      break
    case STRUCTURE_STORAGE:
      if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        energyStores.push(structure)
      }
      break
    case STRUCTURE_TERMINAL:
      if (structure.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        energyStores.push(structure)
      }
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
    calculateSourceRouteIn(room, sources, spawns[0].pos)
  } else {
    const spawnConstructionSite = constructionSites.find(site => site.structureType === STRUCTURE_SPAWN)
    if (spawnConstructionSite != null) {
      calculateSourceRouteIn(room, sources, spawnConstructionSite.pos)
    }
  }

  return {
    controller,
    sources,
    constructionSites,
    damagedStructures,
    activeStructures: {
      spawns,
      extensions,
      towers,
      chargeableStructures,
    },
    hostiles: {
      creeps: hostileCreeps,
      powerCreeps: hostilePowerCreeps,
    },
    alliances: {
      creeps: allianceCreeps,
      powerCreeps: alliancePowerCreeps,
    },
    droppedResources,
    tombStones,
    energyStores,
    flags,
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
