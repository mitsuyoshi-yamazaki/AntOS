import { RoomName, RoomPathMemory } from "prototype/room"
import { EnergyChargeableStructure } from "prototype/room_object"
import { calculateSourceRoute } from "script/pathfinder"

interface OwnedRoomObjects {
  controller: StructureController
  idleCreeps: Creep[]
  sources: Source[]
  constructionSites: ConstructionSite<BuildableStructureConstant>[] // TODO: 優先順位づけ等
  activeStructures: {
    spawns: StructureSpawn[]
    extensions: StructureExtension[]
    towers: StructureTower[]

    damagedStructures: AnyOwnedStructure[]
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
  flags: Flag[]
}

const cache = new Map<RoomName, OwnedRoomObjects>()

export const OwnedRoomObjectCache = {
  clearCache: (): void => {
    cache.clear()
  },

  createCache: (room: Room): void => {
    const objects = enumerateObjectsIn(room)
    if (objects == null) {
      return
    }
    cache.set(room.name, objects)
  },

  objectsInRoom: (room: Room): OwnedRoomObjects | null => {
    return cache.get(room.name) ?? null
  },

  allRoomObjects: (): OwnedRoomObjects[] => {
    return Array.from(cache.values())
  }
}

function enumerateObjectsIn(room: Room): OwnedRoomObjects | null {
  if (room.controller == null || room.controller.my !== true) {
    return null
  }

  const controller = room.controller
  const idleCreeps: Creep[] = []//room.find(FIND_MY_CREEPS).filter(creep => creep.spawning !== true && (creep.memory.tt ?? 0) < idleTime) // TODO: 他人の制御権を奪わないかどうか
  const sources = room.find(FIND_SOURCES)
  const spawns: StructureSpawn[] = []
  const extensions: StructureExtension[] = []
  const towers: StructureTower[] = []
  const damagedStructures: AnyOwnedStructure[] = []
  const chargeableStructures: EnergyChargeableStructure[] = []
  const constructionSites: ConstructionSite<BuildableStructureConstant>[] = room.find(FIND_MY_CONSTRUCTION_SITES)

  const flags = room.find(FIND_FLAGS)

  const wallTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
  const myStructures = room.find(FIND_MY_STRUCTURES)
  myStructures.forEach(structure => {
    if (structure.isActive() !== true) {
      return
    }
    if (wallTypes.includes(structure.structureType) !== true && structure.hits < structure.hitsMax) {
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
    idleCreeps,
    sources,
    constructionSites,
    activeStructures: {
      spawns,
      extensions,
      towers,
      damagedStructures,
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
