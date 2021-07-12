import { RoomName } from "utility/room_name"
import { ShortVersion } from "./system_info"

const oldShardName = "shard2"
const oldRoomNames: RoomName[] = [
  "W53S5",
  "W54S7",
  "W51S29",
  "W48S6",
  "W48S12",
]


export const Migration = {
  roomVersion: function (roomName: RoomName): ShortVersion {
    if (isOldRoom(roomName) === true) {
      return ShortVersion.v3
    }
    return ShortVersion.v5
  }
}

function isOldRoom(roomName: RoomName): boolean {
  if (Game.shard.name !== oldShardName) {
    return false
  }
  return oldRoomNames.includes(roomName)
}
