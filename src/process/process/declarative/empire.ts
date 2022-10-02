import { RoomName } from "shared/utility/room_name_types"

type RoomInfo = {
  readonly requiredResources: Map<ResourceConstant, number>
}

const allRoomInfo = new Map<RoomName, RoomInfo>()

export const EmpireInfo = {
  getRoomInfo(roomName: RoomName): RoomInfo | null {
    return allRoomInfo.get(roomName) ?? null
  },
}

// self-awarenessあたりの名前に変更したらどうか
