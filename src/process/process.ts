import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { LoggerProcess, LoggerProcessState } from "os/process/logger"
import { TestProcess, TestProcessState } from "process/test/test_process"
import { RoomKeeperProcess, RoomKeeperProcessState } from "./room_keeper_process"

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

  // ---- v5 process ---- //
  "RoomKeeperProcess" = (state: ProcessState) => RoomKeeperProcess.decode(state as RoomKeeperProcessState)

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
