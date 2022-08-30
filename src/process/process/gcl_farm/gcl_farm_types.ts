import { RoomName } from "shared/utility/room_name"
import { GclFarmPositions } from "./gcl_farm_predefined_plans"

export type GclFarmRoom = {
  readonly roomName: RoomName
  readonly parentRoomNames: RoomName[]
  readonly plan: GclFarmPositions
}
