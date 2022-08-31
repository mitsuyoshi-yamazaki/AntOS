import type { RoomName } from "shared/utility/room_name_types"

namespace SaboteurTower {
  export type Plan = {
    readonly roomName: RoomName
  }

  export const calculatePlan = (targetRoom: Room): Plan | null => {
    return null
  }
}
