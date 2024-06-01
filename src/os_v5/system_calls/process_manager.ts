import { SystemCall } from "os_v5/system_call"

type ProcessManagerMemory = {
}

let processManagerMemory: ProcessManagerMemory = {}

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
