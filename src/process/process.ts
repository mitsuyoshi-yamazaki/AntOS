import { Stateful } from "os/infrastructure/state"
import type { ProcessState } from "./process_state"

export type ProcessId = number

export interface Process extends Stateful {
  launchTime: number
  processId: ProcessId

  processShortDescription?(): string
  processDescription?(): string
  encode(): ProcessState
}
