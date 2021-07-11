import { ErrorMapper } from "error_mapper/ErrorMapper"
import { LoggerProcess, LoggerProcessState } from "os/process/logger"
import { TestProcess, TestProcessState } from "process/test/test_process"
import { BootstrapRoomManagerProcess, BootstrapRoomManagerProcessState } from "./bootstrap_room_manager_process"
import type { Process } from "./process"
import type { ProcessState } from "./process_state"
import { RoomKeeperProcess, RoomKeeperProcessState } from "./room_keeper_process"
import { TaskProcess, TaskProcessState } from "./task_process"

export type ProcessTypeIdentifier = keyof ProcessTypes
class ProcessTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "TestProcess" = (state: ProcessState) => TestProcess.decode(state as unknown as TestProcessState)
  "LoggerProcess" = (state: ProcessState) => LoggerProcess.decode(state as unknown as LoggerProcessState)

  // ---- v5 process ---- //
  "RoomKeeperProcess" = (state: ProcessState) => RoomKeeperProcess.decode(state as unknown as RoomKeeperProcessState)
  "BootstrapRoomManagerProcess" = (state: ProcessState) => BootstrapRoomManagerProcess.decode(state as unknown as BootstrapRoomManagerProcessState)
  "TaskProcess" = (state: ProcessState) => TaskProcess.decode(state as unknown as TaskProcessState)

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
