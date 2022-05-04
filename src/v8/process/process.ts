import { State, Stateful } from "os/infrastructure/state"
import { CompressedProcessType } from "./process_type"

export type ProcessId = string

export interface ProcessState extends State {
  readonly i: ProcessId
  readonly t: CompressedProcessType
}

export interface Process<T, S, U, R> extends Stateful {
  readonly processId: ProcessId

  run(args: T): S
  handleSubprocesses?(result: U): R
}
