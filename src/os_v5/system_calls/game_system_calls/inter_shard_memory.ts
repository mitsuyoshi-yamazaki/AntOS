
import { v5Namespace } from "os_v5/os_info"
import { Mutable } from "shared/utility/types"
import { SystemCall } from "../../system_call"

const v5InterShardNamespace: v5Namespace = "osv5"

type InterShardMemoryManagerMemory = {
  readonly runningShardNames: string[]
}

const initializeMemory = (rawMemory: unknown): InterShardMemoryManagerMemory => {
  const memory = rawMemory as Mutable<InterShardMemoryManagerMemory>

  if (memory.runningShardNames == null) {
    memory.runningShardNames = []
  }

  return memory
}

let interShardMemoryManagerMemory: InterShardMemoryManagerMemory = {} as InterShardMemoryManagerMemory

type InterShardMemoryManager = {
  getRunningShardNames(): string[]
  // TODO:
}

export const InterShardMemoryManager: SystemCall<"InterShardMemoryManager", InterShardMemoryManagerMemory> & InterShardMemoryManager = {
  name: "InterShardMemoryManager",
  [Symbol.toStringTag]: "InterShardMemoryManager",

  load(memory: InterShardMemoryManagerMemory): void {
    interShardMemoryManagerMemory = initializeMemory(memory)
  },

  startOfTick(): void {
  },

  endOfTick(): InterShardMemoryManagerMemory {
    return interShardMemoryManagerMemory
  },

  // InterShardMemoryManager
  getRunningShardNames(): string[] {
    return [...interShardMemoryManagerMemory.runningShardNames]
  },
}
