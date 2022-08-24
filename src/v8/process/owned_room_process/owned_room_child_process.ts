import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { roomLink } from "utility/log"
import type { RoomName } from "utility/room_name"
import { Process } from "../process"

export abstract class OwnedRoomChildProcess extends Process {
  public abstract roomName: RoomName

  public abstract runWith(roomResource: OwnedRoomResource): void

  public shortDescription = (): string => {
    return roomLink(this.roomName)
  }
}
