import { RoomName } from "utility/room_name"

export interface LaunchableTask {
  roomName: RoomName
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isLaunchableTask(arg: any): arg is LaunchableTask {
  return arg.roomName !== undefined
}
