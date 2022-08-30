import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomName } from "shared/utility/room_name"
import { roomLink } from "./log"
import { ShortVersion } from "../shared/utility/system_info"

export const Migration = {
  roomVersion: function (roomName: RoomName): ShortVersion {
    const version = Memory.room_info[roomName]?.v
    if (version == null) {
      PrimitiveLogger.fatal(`Room ${roomLink(roomName)} doesn't have room_info memory`)
      return ShortVersion.v5
    }
    return version
  }
}
