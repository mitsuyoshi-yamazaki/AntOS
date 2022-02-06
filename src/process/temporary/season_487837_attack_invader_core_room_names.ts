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
  case "season 4":
  case "simulation":
  case "botarena":
  default:
    return new ValuedArrayMap<RoomName, RoomName>([
    ])
  }
})()
