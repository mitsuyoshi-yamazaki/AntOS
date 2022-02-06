import { remoteRoomNamesToDefend } from "process/temporary/season_487837_attack_invader_core_room_names"
import { RoomName } from "utility/room_name"

const remoteRoomsToAdd = new Map<RoomName, RoomName[]>()

export const RemoteRoomManager = {
  addRemoteRooms(parentRoomName: RoomName, remoteRoomNames: RoomName[]): void { // Migration用
    if (remoteRoomsToAdd.has(parentRoomName) === true) {
      return
    }
    const remoteRooms = remoteRoomNames.filter(roomName => (isRemoteRoomLaunched(parentRoomName, roomName) !== true))
    remoteRoomsToAdd.set(parentRoomName, remoteRooms)
  },

  removeRemoteRooms(parentRoomName: RoomName): void {
    remoteRoomsToAdd.delete(parentRoomName)
  },

  remoteRoomsToAdd(parentRoomName: RoomName): RoomName[] {
    return remoteRoomsToAdd.get(parentRoomName) ?? []
  },
}

function isRemoteRoomLaunched(parentRoomName: RoomName, remoteRoomName: RoomName): boolean {
  const launchedRemoteRooms = remoteRoomNamesToDefend.getValueFor(parentRoomName)
  return launchedRemoteRooms.includes(remoteRoomName)
}
