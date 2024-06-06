
import { checkMemoryIntegrity } from "os_v5/utility/types"
import { Mutable } from "shared/utility/types"
import { SystemCall } from "../../system_call"

type UniqueNameMemory = {
  uniqueIdIndex: number
}

const initializeMemory = (rawMemory: unknown): UniqueNameMemory => {
  const memory = rawMemory as Mutable<UniqueNameMemory>

  if (memory.uniqueIdIndex == null) {
    memory.uniqueIdIndex = 1
  }

  return memory
}

let uniqueNameMemory: UniqueNameMemory = initializeMemory({})

type UniqueName = {
  generate(): string
}

export const UniqueName: SystemCall & UniqueName = {
  name: "UniqueName",

  load(memoryReference: unknown): void {
    const initializedMemory = initializeMemory(memoryReference)
    checkMemoryIntegrity(uniqueNameMemory, initializeMemory, "UniqueName")
    uniqueNameMemory = initializedMemory
  },

  startOfTick(): void {
  },

  endOfTick(): void {
  },

  // UniqueId
  generate(): string {
    return "TODO"
  },
}
