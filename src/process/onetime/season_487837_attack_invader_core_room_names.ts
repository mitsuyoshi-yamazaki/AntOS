import { RoomName } from "utility/room_name"

export const remoteRoomNamesToDefend = new Map<RoomName, RoomName[]>([
  ["W27S26", ["W28S26", "W27S27", "W27S25"]],
  ["W24S29", ["W25S29", "W23S29", "W24S28"]],
  ["W14S28", ["W15S28", "W14S29", "W14S27"]],
  ["W9S24", ["W9S25", "W8S24"]],
  ["W1S25", ["W2S25", "W1S24"]],
  // ["E5S23", ["E4S23", "E6S23"]],
  ["W3S24", ["W3S23"]],
  ["W21S23", ["W21S22", "W22S23", "W21S24"]],
  ["W6S29", ["W5S29"]],
])
