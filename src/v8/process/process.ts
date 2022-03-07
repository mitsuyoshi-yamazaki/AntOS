import { State, Stateful } from "os/infrastructure/state"

export type ProcessId = string
export type ProcessType = string

export interface ProcessState extends State {
  readonly i: ProcessId
  readonly t: ProcessType
}

export interface Process<T> extends Stateful {
  readonly processId: ProcessId

  run(args: T): void
}
