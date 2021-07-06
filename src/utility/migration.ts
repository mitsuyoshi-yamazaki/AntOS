import { RoomName } from "prototype/room"
import { ShortVersion } from "./system_info"

const oldShardName = "shard2"
const oldRoomNames: RoomName[] = [
  "W53S5",
  "W54S7",
  "W51S29",
  "W48S6",
  "W48S12",
]

const v4RoomNames: RoomName[] = [
  // "W51S37",
  // "W52S28",
  // "W53S36",
  // "W53S7",
]

export const Migration = {
  roomVersion: function (roomName: RoomName): ShortVersion {
    if (isOldRoom(roomName) === true) {
      return ShortVersion.v3
    }
    if (v4RoomNames.includes(roomName) === true) {
      return ShortVersion.v4
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
