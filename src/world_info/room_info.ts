import { RoomName } from "prototype/room"
// Worldをimportしない

export const Rooms = {
  get: function (roomName: RoomName): Room | null {
    return Game.rooms[roomName]
  },
}
