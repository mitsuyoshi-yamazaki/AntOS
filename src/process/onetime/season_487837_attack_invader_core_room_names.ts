import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Environment } from "utility/environment"
import { RoomName } from "utility/room_name"
import { ValuedArrayMap } from "utility/valued_collection"

export const remoteRoomNamesToDefend = ((): ValuedArrayMap<RoomName, RoomName> => {
  switch (Environment.world) {
  case "persistent world":
    switch (Environment.shard) {
    case "shard0":
    case "shard1":
      return new ValuedArrayMap<RoomName, RoomName>([
      ])
    case "shard2":
      return new ValuedArrayMap<RoomName, RoomName>([
        ["W57S27", ["W57S26", "W57S28"]],
        ["W52S25", ["W52S26"]],
        ["W53S36", ["W52S36"]],
      ])
    case "shard3":
      return new ValuedArrayMap<RoomName, RoomName>([
      ])
    default:
      if ((Game.time % 19) === 11) {
        PrimitiveLogger.programError(`remoteRoomNamesToDefend unknown shard name ${Environment.shard} in ${Environment.world}`)
      }
      return new ValuedArrayMap<RoomName, RoomName>([
      ])
    }
  case "season 3":
    return new ValuedArrayMap<RoomName, RoomName>([
      ["W27S26", ["W27S27", "W27S25"]], // "W28S26"
      ["W24S29", ["W25S29", "W23S29", "W24S28"]],
      ["W14S28", ["W15S28", "W14S29", "W14S27"]],
      ["W9S24", ["W9S25", "W8S24"]],
      ["W1S25", ["W2S25", "W1S24"]],
      // ["E5S23", ["E4S23", "E6S23"]],
      ["W3S24", ["W3S23", "W3S25", "W4S24"]],
      ["W21S23", ["W21S22", "W22S23", "W21S24"]],
      ["W6S29", ["W5S29"]], // W7S29
      ["W6S27", ["W5S27"]],  // W7S27
      ["W29S25", ["W28S25"]],
      ["W17S11", ["W18S11"]],
      ["W15S8", ["W16S8", "W15S9", "W14S8"]],
      ["W26S9", ["W26S8"]],
      ["W5S21", ["W6S21", "W5S22", "W4S21"]],
    ])
  case "simulation":
  case "botarena":
  default:
    return new ValuedArrayMap<RoomName, RoomName>([
    ])
  }
})()
