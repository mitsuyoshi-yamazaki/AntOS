import type { CreepProviderApi } from "os_v5/processes/bot/creep_provider_api"
import type { RoomName } from "shared/utility/room_name_types"
import type { ScoutRoomProcess } from "./scout_room_process"


export type ScoutRoomProblemCreepAttacked = {
  readonly case: "creep_attacked"
}
export type ScoutRoomProblemRoomUnreachable = {
  readonly case: "room_unreachable"
  readonly blockingRoomName: RoomName
}
export type ScoutRoomProblemUnknown = {
  readonly case: "unknown"
  readonly reason: string
}
export type ScoutRoomProblem = ScoutRoomProblemCreepAttacked
  | ScoutRoomProblemRoomUnreachable
  | ScoutRoomProblemUnknown


/// 呼び出されるのは afterRun() のタイミングであることがある
export type ScoutRoomDelegate = CreepProviderApi & {
  scoutRoomDidFinishScouting(process: ScoutRoomProcess, room: Room): void
  scoutRoomDidFailScouting(process: ScoutRoomProcess, problem: ScoutRoomProblem): void
}
