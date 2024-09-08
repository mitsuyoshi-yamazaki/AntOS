import type { CreepProviderApi } from "os_v5/processes/bot/creep_provider_api"
import type { RoomName } from "shared/utility/room_name_types"
import type { RoomKeeperProcess } from "./room_keeper_process"


export type RoomKeeperProblemUnclaimed = {
  readonly case: "unclaimed"
}
export type RoomKeeperProblemHostileCreepsInRoom = {
  readonly case: "hostile_creeps"
}
export type RoomKeeperProblemRoomAttacked = {
  readonly case: "room_attacked"
}
export type RoomKeeperProblemControllerUnreachable = {
  readonly case: "controller_unreachable"
}
export type RoomKeeperProblemRoomUnreachable = {
  readonly case: "room_unreachable"
  readonly blockingRoomName: RoomName
}
export type RoomKeeperProblemUnknown = {
  readonly case: "unknown"
  readonly reason: string
}
export type RoomKeeperProblem = RoomKeeperProblemUnclaimed
  | RoomKeeperProblemHostileCreepsInRoom
  | RoomKeeperProblemRoomAttacked
  | RoomKeeperProblemControllerUnreachable
  | RoomKeeperProblemRoomUnreachable
  | RoomKeeperProblemUnknown


/// 呼び出されるのは afterRun() のタイミングであることがある
export type RoomKeeperDelegate = CreepProviderApi & {
  roomKeeperDidRaiseProblem(process: RoomKeeperProcess, problem: RoomKeeperProblem): void
}
