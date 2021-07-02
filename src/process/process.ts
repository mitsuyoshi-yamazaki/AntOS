import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { OperatingSystem } from "os/os"
import { LoggerProcess, LoggerProcessState } from "os/process/logger"
import { TestProcess, TestProcessState } from "old_objective/test/test_process"
import { BootstrapL8RoomProcess, BootstrapL8RoomProcessState } from "../old_objective/bootstrap_room/bootstrap_l8_room_proces"
import { ClaimRoomProcess, ClaimRoomProcessState } from "../old_objective/bootstrap_room/old_claim_room_process"
import { RoomKeeperProcess, RoomKeeperProcessState } from "../old_objective/room_keeper/room_keeper_process"
import { InterShardCreepDelivererProcess, InterShardCreepDelivererProcessState } from "../old_objective/creep_provider/inter_shard_creep_deliverer_process"
import { War29337295Process, War29337295ProcessState } from "../old_objective/test/war_29337295_process"
import { War29337295LogisticsProcess, War29337295LogisticsProcessState } from "../old_objective/test/war_ 29337295_logistics_process"
import { Season3War11353Process, Season3War11353ProcessState } from "old_objective/test/season3_war_11353_process"

export type ProcessId = number

export interface ProcessState extends State {
  /** type identifier */
  t: keyof ProcessTypes

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

class ProcessTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "TestProcess" = (state: ProcessState) => TestProcess.decode(state as TestProcessState)
  "LoggerProcess" = (state: ProcessState) => LoggerProcess.decode(state as LoggerProcessState)
  "BootstrapL8RoomProcess" = (state: ProcessState) => BootstrapL8RoomProcess.decode(state as BootstrapL8RoomProcessState)
  "ClaimRoomProcess" = (state: ProcessState) => ClaimRoomProcess.decode(state as ClaimRoomProcessState)
  "RoomKeeperProcess" = (state: ProcessState) => RoomKeeperProcess.decode(state as RoomKeeperProcessState)
  "InterShardCreepDelivererProcess" = (state: ProcessState) => InterShardCreepDelivererProcess.decode(state as InterShardCreepDelivererProcessState)

  // onetime processes
  "War29337295Process" = (state: ProcessState) => War29337295Process.decode(state as War29337295ProcessState)
  "War29337295LogisticsProcess" = (state: ProcessState) => War29337295LogisticsProcess.decode(state as War29337295LogisticsProcessState)
  "Season3War11353Process" = (state: ProcessState) => Season3War11353Process.decode(state as Season3War11353ProcessState)
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
