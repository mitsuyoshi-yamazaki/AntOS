import { RoomName } from "../utility/room_name"

export type GameMapMemory = {
  interRoomPath: { [roomName: string]: { [destinationRoomName: string]: RoomName[] } }
}

export const GameMap = {
  getWaypoints(roomName: RoomName, destinationRoomName: RoomName): RoomName[] | null {
    const infoList = Memory.gameMap.interRoomPath[roomName]
    if (infoList == null) {
      return null
    }
    return infoList[destinationRoomName] ?? null
  },

  setWaypoints(roomName: RoomName, destinationRoomName: RoomName, waypoints: RoomName[]): void {
    const infoList = ((): { [destinationRoomName: string]: RoomName[] } => {
      const stored = Memory.gameMap.interRoomPath[roomName]
      if (stored != null) {
        return stored
      }
      const list: { [destinationRoomName: string]: RoomName[] } = {}
      Memory.gameMap.interRoomPath[roomName] = list
      return list
    })()
    infoList[destinationRoomName] = waypoints
  },
}
