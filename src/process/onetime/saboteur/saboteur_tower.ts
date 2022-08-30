import { RoomName } from "shared/utility/room_name"

namespace SaboteurTower {
  export type Plan = {
    readonly roomName: RoomName
  }

  export const calculatePlan = (targetRoom: Room): Plan | null => {
    return null
  }
}
