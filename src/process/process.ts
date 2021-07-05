import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { OperatingSystem } from "os/os"
import { LoggerProcess, LoggerProcessState } from "os/process/logger"
import { TestProcess, TestProcessState } from "old_objective/test/test_process"
import { BootstrapL8RoomProcess, BootstrapL8RoomProcessState } from "../old_objective/bootstrap_room/bootstrap_l8_room_proces"
import { RoomKeeperProcess, RoomKeeperProcessState } from "../old_objective/room_keeper/room_keeper_process"
import { InterShardCreepDelivererProcess, InterShardCreepDelivererProcessState } from "../old_objective/creep_provider/inter_shard_creep_deliverer_process"
import { ObjectiveProcess, ObjectiveProcessState } from "./objective_process"
import { ClaimRoomProcess, ClaimRoomProcessState } from "./claim_room_process"

export type ProcessId = number

export interface ProcessState extends State {
  /** type identifier */
  t: ProcessTypeIdentifier

  /** launch time */
  l: number

  /** process ID */
  i: number
}

export interface Process extends Stateful {
  launchTime: number
  processId: ProcessId

  processShortDescription?(): string
  processDescription?(): string
  encode(): ProcessState
}

export type ProcessTypeIdentifier = keyof ProcessTypes
class ProcessTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "TestProcess" = (state: ProcessState) => TestProcess.decode(state as TestProcessState)
  "LoggerProcess" = (state: ProcessState) => LoggerProcess.decode(state as LoggerProcessState)
  "BootstrapL8RoomProcess" = (state: ProcessState) => BootstrapL8RoomProcess.decode(state as BootstrapL8RoomProcessState)
  "RoomKeeperProcess" = (state: ProcessState) => RoomKeeperProcess.decode(state as RoomKeeperProcessState)
  "InterShardCreepDelivererProcess" = (state: ProcessState) => InterShardCreepDelivererProcess.decode(state as InterShardCreepDelivererProcessState)

  // ---- v5 process ---- //
  "ObjectiveProcess" = (state: ProcessState) => ObjectiveProcess.decode(state as ObjectiveProcessState)
  "ClaimRoomProcess" = (state: ProcessState) => ClaimRoomProcess.decode(state as ClaimRoomProcessState)

  // ---- onetime processes ---- //
}

export function decodeProcessFrom(state: ProcessState): Process | null {
  let decoded: Process | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new ProcessTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeProcessFrom(), process type: ${state.t}`)()
  return decoded
}

export function processLog(sender: Process, message: string): void {
  OperatingSystem.os.addProcessLog({
    processId: sender.processId,
    processType: sender.constructor.name,
    message: message
  })
}
