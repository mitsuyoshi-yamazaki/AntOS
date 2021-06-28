import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { OperatingSystem } from "os/os"
import { LoggerProcess, LoggerProcessState } from "os/process/logger"
import { TestProcess, TestProcessState } from "objective/test/test_process"
import { BootstrapL8RoomProcess, BootstrapL8RoomProcessState } from "./bootstrap_room/bootstrap_l8_room_proces"
import { ClaimRoomProcess, ClaimRoomProcessState } from "./bootstrap_room/claim_room_process"
import { SignRoomsProcess, SignRoomsProcessState } from "./sign_rooms/sign_rooms_process"
import { RoomKeeperProcess, RoomKeeperProcessState } from "./room_keeper/room_keeper_process"

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
  "SignRoomsProcess" = (state: ProcessState) => SignRoomsProcess.decode(state as SignRoomsProcessState)
  "BootstrapL8RoomProcess" = (state: ProcessState) => BootstrapL8RoomProcess.decode(state as BootstrapL8RoomProcessState)
  "ClaimRoomProcess" = (state: ProcessState) => ClaimRoomProcess.decode(state as ClaimRoomProcessState)
  "RoomKeeperProcess" = (state: ProcessState) => RoomKeeperProcess.decode(state as RoomKeeperProcessState)
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
