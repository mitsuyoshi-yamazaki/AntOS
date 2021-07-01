import { RoomName } from "prototype/room"

const oldShardName = "shard2"
const oldRoomNames: RoomName[] = [
  "W53S5",
  "W54S7",
  "W51S29",
  "W48S6",
  "W48S12",
]


export const Migration = {
  isOldRoom: function (roomName: RoomName): boolean {
    if (Game.shard.name !== oldShardName) {
      return false
    }
    return oldRoomNames.includes(roomName)
  }
}
