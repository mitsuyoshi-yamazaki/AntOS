import { RoomName } from "prototype/room"
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

  return {
    controller,
    sources,
    constructionSites,
    activeStructures: {
      spawns,
      extensions,
      towers,
      chargeableStructures,
    }
  }
}
