import { State, Stateful } from "os/infrastructure/state"
import type { Timestamp } from "utility/timestamp"
import type { AsynchronousTaskTypeIdentifier } from "./asynchronous_task_decoder"

export type AsynchronousTaskIdentifier = string

export interface AsynchronousTaskState extends State {
  /** type identifier */
  readonly t: AsynchronousTaskTypeIdentifier

  readonly taskIdentifier: AsynchronousTaskIdentifier
  readonly createdAt: Timestamp
}

export interface AsynchronousTask extends Stateful {
  readonly createdAt: Timestamp
  readonly taskIdentifier: AsynchronousTaskIdentifier

  taskShortDescription?(): string
  encode(): AsynchronousTaskState
  run(): void
}
