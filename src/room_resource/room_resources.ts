import { isV5CreepMemory } from "prototype/creep"
import { RoomName } from "utility/room_name"
import { ShortVersion } from "utility/system_info"
import { decodeRoomInfo, RoomInfo } from "world_info/room_info"
import { NormalRoomResource } from "./room_resource/normal_room_resource"
import { OwnedRoomResource } from "./room_resource/owned_room_resource"
import { RoomResource } from "./room_resource/room_resource"

interface RoomResources {
  // ---- Lifecycle ---- //
  beforeTick(): void
  afterTick(): void

  // ---- Function ---- //
  getRoomResource(roomName: RoomName): RoomResource | null
}

const roomResources = new Map<RoomName, RoomResource>()

export const RoomResources = {
  // ---- Lifecycle ---- //
  beforeTick(): void {
    roomResources.clear()
    const allCreeps = enumerateCreeps()

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName]

      if (room.controller != null && room.controller.my === true) {
        roomResources.set(roomName, buildOwnedRoomResource(room.controller, allCreeps.get(roomName) ?? []))
      }
    }
  },

  afterTick(): void {

  },

  // ---- Function ---- //
  getRoomResource(roomName: RoomName): RoomResource | null {
    const stored = roomResources.get(roomName)
    if (stored != null) {
      return stored
    }
    const room = Game.rooms[roomName]
    if (room == null || room.controller == null) {
      return null
    }
    const roomResource = buildNormalRoomResource(room.controller)
    roomResources.set(roomName, roomResource)
    return roomResource
  },
}

function enumerateCreeps(): Map<RoomName, Creep[]> {
  const allCreeps = new Map < RoomName, Creep[]>()

  for (const creepName in Memory.creeps) {
    const creep = Game.creeps[creepName]
    if (creep == null) {
      delete Memory.creeps[creepName]
      continue
    }
    if (!isV5CreepMemory(creep.memory)) {
      continue
    }
    const creeps = ((): Creep[] => {
      const stored = allCreeps.get(creep.memory.p)
      if (stored != null) {
        return stored
      }
      const newList: Creep[] = []
      allCreeps.set(creep.memory.p, newList)
      return newList
    })()

    creeps.push(creep)
  }

  return allCreeps
}

function buildNormalRoomResource(controller: StructureController): NormalRoomResource {
  const roomInfo = ((): RoomInfo | null => {
    const roomInfoMemory = Memory.room_info[controller.room.name]
    if (roomInfoMemory == null) {
      return null
    }
    return decodeRoomInfo(roomInfoMemory)
  })()
  return new NormalRoomResource(controller, roomInfo)
}

function buildOwnedRoomResource(controller: StructureController, creeps: Creep[]): OwnedRoomResource {
  const roomInfo = ((): RoomInfo => {
    const roomInfoMemory = Memory.room_info[controller.room.name]
    if (roomInfoMemory == null) {
      return {
        version: ShortVersion.v6,
        energySourceStructures: [],
        energyStoreStructures: [],
        upgrader: null,
        distributor: null,
      }
    }
    return decodeRoomInfo(roomInfoMemory)
  })()
  return new OwnedRoomResource(controller, [...creeps], roomInfo)
}
