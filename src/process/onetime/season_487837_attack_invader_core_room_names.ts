import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Environment } from "utility/environment"
import { RoomName } from "utility/room_name"

export const remoteRoomNamesToDefend = ((): Map<RoomName, RoomName[]> => {
  switch (Environment.world) {
  case "persistent world":
    switch (Environment.shard) {
    case "shard0":
    case "shard1":
      return new Map<RoomName, RoomName[]>([
      ])
    case "shard2":
      return new Map<RoomName, RoomName[]>([
        ["W57S27", ["W57S26", "W57S28"]],
        ["W52S25", ["W52S26"]],
      ])
    case "shard3":
      return new Map<RoomName, RoomName[]>([
      ])
    default:
      if ((Game.time % 19) === 11) {
        PrimitiveLogger.programError(`remoteRoomNamesToDefend unknown shard name ${Environment.shard} in ${Environment.world}`)
      }
      return new Map<RoomName, RoomName[]>([
      ])
    }
  case "simulation":
    return new Map<RoomName, RoomName[]>([
    ])
  case "season 3":
    return new Map<RoomName, RoomName[]>([
      ["W27S26", ["W28S26", "W27S27", "W27S25"]],
      ["W24S29", ["W25S29", "W23S29", "W24S28"]],
      ["W14S28", ["W15S28", "W14S29", "W14S27"]],
      ["W9S24", ["W9S25", "W8S24"]],
      ["W1S25", ["W2S25", "W1S24"]],
      // ["E5S23", ["E4S23", "E6S23"]],
      ["W3S24", ["W3S23", "W3S25", "W4S24"]],
      ["W21S23", ["W21S22", "W22S23", "W21S24"]],
      ["W6S29", ["W5S29", "W7S29"]],
      ["W6S27", ["W5S27", "W7S27"]],
      ["W29S25", ["W28S25"]],
    ])
  }
})()
