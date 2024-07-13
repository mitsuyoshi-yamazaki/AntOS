import { AnyProcessId } from "os_v5/process/process"
import { SystemCall } from "os_v5/system_call"
import { EmptySerializable } from "os_v5/utility/types"

type ScheduledStaticTaskInterval = "10" | "100" | "1000" | "10000" | "50000"

type ScheduledStaticTaskManager = {
  add(processId: AnyProcessId, interval: ScheduledStaticTaskInterval, task: () => void, options?: {canSkip?: 1|2|4}): void
}

// const taskQueue =
// const tasks =


export const ScheduledStaticTaskManager: SystemCall<"ScheduledStaticTaskManager", EmptySerializable> & ScheduledStaticTaskManager = {
  name: "ScheduledStaticTaskManager",
  [Symbol.toStringTag]: "ScheduledStaticTaskManager",

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): EmptySerializable {
    return {}
  },

  // ScheduledStaticTaskManager
  add(processId: AnyProcessId, interval: ScheduledStaticTaskInterval, task: () => void, options?: { canSkip?: 1 | 2 | 4 }): void {
  },
}
