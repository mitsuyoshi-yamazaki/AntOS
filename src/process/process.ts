import { Stateful } from "os/infrastructure/state"
import type { ProcessState } from "./process_state"

export type ProcessId = number
export type ProcessTaskIdentifier = string

export interface Process extends Stateful {
  readonly launchTime: number
  readonly processId: ProcessId
  readonly taskIdentifier: ProcessTaskIdentifier

  processShortDescription?(): string
  processDescription?(): string
  encode(): ProcessState
}
