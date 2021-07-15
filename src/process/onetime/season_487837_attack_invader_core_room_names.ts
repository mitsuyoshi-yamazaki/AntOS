import { RoomName } from "utility/room_name"

export const remoteRoomNamesToDefend = new Map<RoomName, RoomName[]>([
  ["W27S26", ["W28S26", "W27S27", "W27S25"]],
  ["W24S29", ["W25S29", "W23S29", "W24S28"]],
  ["W14S28", ["W15S28", "W14S29"]],
  ["W9S24", ["W9S25", "W8S24"]],
])
