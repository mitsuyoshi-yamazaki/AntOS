import { RoomName, RoomPathMemory } from "prototype/room"
import { EnergyChargeableStructure } from "prototype/room_object"

interface OwnedRoomObjects {
  controller: StructureController
  sources: Source[]
  constructionSites: ConstructionSite<BuildableStructureConstant>[] // TODO: 優先順位づけ等
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
  const sources = room.find(FIND_SOURCES)
  const spawns: StructureSpawn[] = []
  const extensions: StructureExtension[] = []
  const towers: StructureTower[] = []
  const chargeableStructures: EnergyChargeableStructure[] = []
  const constructionSites: ConstructionSite<BuildableStructureConstant>[] = room.find(FIND_MY_CONSTRUCTION_SITES)

  const myStructures = room.find(FIND_MY_STRUCTURES)
  myStructures.forEach(structure => {
    if (structure.isActive() !== true) {
      return
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

  return {
    controller,
    sources,
    constructionSites,
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
    }
  }
}



// function calculateSourceRoute(room: Room, sources: Source[], destination: RoomPosition): void {
//   const pathInMemory: RoomPathMemory = room.memory.p ?? { s: {} }
//   if (room.memory.p == null) {
//     room.memory.p = pathInMemory
//   }

//   sources.forEach(source => {
//     const sourcePath = pathInMemory.s[source.id]
//     if (sourcePath == null) {
//       const result = calculateSourceRoute(source.id, spawn.pos)
//       switch (result.resultType) {
//       case "succeeded": {
//         const path = result.value.path.path.map(position => ({ x: position.x, y: position.y }))
//         path.push(...result.value.harvestPositions.map(position => ({ x: position.x, y: position.y })))
//         pathInMemory.s[source.id] = {
//           p: path,
//           d: { x: spawn.pos.x, y: spawn.pos.y },
//         }
//         console.log(`source path calculated with ${result.value.harvestPositions.length} harvest position`)
//         break
//       }
//       case "failed":
//         pathInMemory.s[source.id] = "no path"
//         console.log(`source path cannot found: ${result.reason}`)
//         break
//       }
//       return
//     }
//     if (sourcePath === "no path") {
//       return
//     }
//     // console.log(`source path found for ${source.id}`)
//     // sourcePath.p.forEach(position => source.room.visual.text("*", position.x, position.y))
//   })
// }
