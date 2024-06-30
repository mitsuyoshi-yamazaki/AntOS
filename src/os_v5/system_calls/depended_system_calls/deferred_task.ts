import type { AnyProcessId } from "os_v5/process/process"
import type { Result } from "shared/utility/result_v2"
import type { Timestamp } from "shared/utility/timestamp"


// Task
export type DeferredTaskId = string
export const deferredTaskPriority = {
  urgent:   0,
  high:     10,
  normal:   20,
  low:      30,
  anytime:  40,
} as const
export type DeferredTaskPriority = number

export type DeferredTaskState<TaskType extends string> = {
  readonly id: DeferredTaskId
  readonly processId: AnyProcessId
  readonly taskType: TaskType
}
export type DeferredTask<TaskType extends string, T> = DeferredTaskState<TaskType> & {
  readonly priority: DeferredTaskPriority
  readonly expiredBy: Timestamp | null
  readonly task: () => T
}

export type AnyDeferredTaskState = DeferredTaskState<string>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDeferredTask = DeferredTask<string, any>


// Result
type DeferredTaskErrorServerRestarted = {
  readonly case: "server restarted"
}
type DeferredTaskErrorTaskTerminated = {
  readonly case: "task terminated"
}
type DeferredTaskErrorErrorRaised = {
  readonly case: "error raised"
  readonly error: unknown
}
type DeferredTaskError = DeferredTaskErrorServerRestarted | DeferredTaskErrorTaskTerminated | DeferredTaskErrorErrorRaised
export type DeferredTaskErrorReasons = DeferredTaskError["case"]
export type DeferredTaskResult<TaskType extends string, T> = {
  readonly id: DeferredTaskId
  readonly taskType: TaskType
  readonly result: Result<T, DeferredTaskError>
}
