import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"

export function showOldRoomPlan(roomName: RoomName, layoutName: string, originX: number, originY: number): string {
  const room = Game.rooms[roomName]
  if (room == null) {
    return `Room ${roomLink(roomName)} is not visible`
  }

  room.show_layout(layoutName, { allow_partial: true, origin_pos: { x: originX, y: originY } })
  return "ok"
}

// Game.rooms["W53S36"].find(FIND_FLAGS).forEach(flag => flag.remove())
export function placeOldRoomPlan(roomName: RoomName, layoutName: string, originX: number, originY: number): string {
  const room = Game.rooms[roomName]
  if (room == null) {
    return `Room ${roomLink(roomName)} is not visible`
  }

  room.place_layout(layoutName, { allow_partial: true, origin_pos: { x: originX, y: originY } })
  return "ok"
}
