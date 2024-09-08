import type { CreepProviderApi } from "os_v5/processes/bot/creep_provider_api"
import type { RoomName } from "shared/utility/room_name_types"
import type { ClaimRoomProcess } from "./claim_room_process"

export type ClaimRoomProblemClaimFailed = {
  readonly case: "claim_failed"
  readonly reason: "max" | "not_neutral" | "no_controller" | ""
}
export type ClaimRoomProblemCreepAttacked = {
  readonly case: "creep_attacked"
}
export type ClaimRoomProblemControllerUnreachable = {
  readonly case: "controller_unreachable"
}
export type ClaimRoomProblemRoomUnreachable = {
  readonly case: "room_unreachable"
  readonly blockingRoomName: RoomName
}
export type ClaimRoomProblemUnknown = {
  readonly case: "unknown"
  readonly reason: string
}
export type ClaimRoomProblem = ClaimRoomProblemClaimFailed
  | ClaimRoomProblemCreepAttacked
  | ClaimRoomProblemControllerUnreachable
  | ClaimRoomProblemRoomUnreachable
  | ClaimRoomProblemUnknown


/// 呼び出されるのは afterRun() のタイミングであることがある
export type ClaimRoomDelegate = CreepProviderApi & {
  claimRoomDidFinishClaiming(process: ClaimRoomProcess): void
  claimRoomDidFailClaiming(process: ClaimRoomProcess, problem: ClaimRoomProblem): void
}
