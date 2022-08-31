import type { RoomName } from "shared/utility/room_name_types"

export interface LaunchableTask {
  roomName: RoomName
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isLaunchableTask(arg: any): arg is LaunchableTask {
  return arg.roomName !== undefined
}
