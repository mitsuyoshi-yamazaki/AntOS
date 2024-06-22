import { AnyProcessId } from "os_v5/process/process"
import { Timestamp } from "shared/utility/timestamp"

export type ProcessExecutionLog = {
  readonly time: Timestamp
  readonly iteratedProcessId: AnyProcessId | null
  readonly iterateFinished: boolean
  readonly errorRaised: Set<AnyProcessId> // runAfterTick() は一旦トラッキングしていない
}
