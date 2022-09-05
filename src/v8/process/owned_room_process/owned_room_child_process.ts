import { roomLink } from "utility/log"
import type { RoomName } from "shared/utility/room_name_types"
import { Process } from "../process"
import { OwnedRoomResource } from "../../operating_system/driver/owned_room_resource/owned_room_resource"

export abstract class OwnedRoomChildProcess extends Process {
  public abstract roomName: RoomName

  public abstract runWith(roomResource: OwnedRoomResource): void

  public shortDescription = (): string => {
    return roomLink(this.roomName)
  }
}
