import { AvailableRoomPositions } from "./room_position"

export type RoomExit = {
  readonly direction: TOP | BOTTOM | LEFT | RIGHT
  readonly position: AvailableRoomPositions
}
