import { RoomName } from "shared/utility/room_name_types"
import { Process } from "./process"

export interface OwnedRoomProcess {
  readonly ownedRoomName: RoomName
}

export const isOwnedRoomProcess = (process: Process): process is (Process & OwnedRoomProcess) => {
  if (typeof (process as { ownedRoomName?: RoomName }).ownedRoomName === "string") {
    return true
  }
  return false
}
