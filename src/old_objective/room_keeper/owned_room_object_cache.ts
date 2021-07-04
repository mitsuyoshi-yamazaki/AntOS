import { RoomName } from "prototype/room"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

const cache = new Map<RoomName, OwnedRoomObjects>()

export const OwnedRoomObjectCache = {
  clearCache: (): void => {
    cache.clear()
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createCache: (room: Room): void => {
    // see: Rooms
  },

  objectsInRoom: (room: Room): OwnedRoomObjects | null => {
    return World.rooms.getOwnedRoomObjects(room.name)
  },

  allRoomObjects: (): OwnedRoomObjects[] => {
    return World.rooms.getAllOwnedRoomObjects()
  }
}
