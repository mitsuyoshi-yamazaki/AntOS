import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export const OwnedRoomObjectCache = {
  objectsInRoom: (room: Room): OwnedRoomObjects | null => {
    return World.rooms.getOwnedRoomObjects(room.name)
  },

  allRoomObjects: (): OwnedRoomObjects[] => {
    return World.rooms.getAllOwnedRoomObjects()
  }
}
