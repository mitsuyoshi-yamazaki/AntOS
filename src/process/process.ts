import { Stateful } from "os/infrastructure/state"
import { Procedural } from "./procedural"
import type { ProcessState } from "./process_state"

export type ProcessId = number
export type ProcessTaskIdentifier = string

export interface Process extends Stateful, Procedural {
  readonly launchTime: number
  readonly processId: ProcessId
  readonly taskIdentifier: ProcessTaskIdentifier
  // readonly schedulePriority: number

  processShortDescription?(): string
  processDescription?(): string
  encode(): ProcessState
}
