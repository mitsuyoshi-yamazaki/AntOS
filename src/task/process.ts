import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { TestProcess, TestProcessState } from "task/test/test_process"
import { BootstrapRoomProcess, BootstrapRoomProcessState } from "./bootstrap_room/bootstrap_room_proces"
import { SignRoomsProcess, SignRoomsProcessState } from "./sign_rooms/sign_rooms_process"

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

  processDescription?(): string
  encode(): ProcessState
}

class ProcessTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "TestProcess" = (state: ProcessState) => TestProcess.decode(state as TestProcessState)
  "SignRoomsProcess" = (state: ProcessState) => SignRoomsProcess.decode(state as SignRoomsProcessState)
  "BootstrapRoomProcess" = (state: ProcessState) => BootstrapRoomProcess.decode(state as BootstrapRoomProcessState)
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
