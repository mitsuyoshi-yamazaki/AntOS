import { SystemCall } from "os_v5/system_call"
import { lazyLoad } from "os_v5/types"

type ProcessManagerMemory = {
}

let processManagerMemory: ProcessManagerMemory = lazyLoad<ProcessManagerMemory>()

type ProcessManager = {
}

export const ProcessManager: SystemCall & ProcessManager = {
  name: "ProcessManager",

  load(memory_reference: unknown): void {
    processManagerMemory = memory_reference as ProcessManagerMemory
  },

  startOfTick(): void {
  },

  endOfTick(): void {
  },
}
