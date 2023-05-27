import type { RoomName } from "./room_name_types"

export const isValidRoomName = (roomName: RoomName): boolean => {
  switch (Game.map.getRoomStatus(roomName).status ) {
  case "normal":
  case "novice":
  case "respawn":
    return true
  case "closed":
  default:  // フォーマットが悪いとundefinedが返る
    return false
  }
}
