
import { Mutable } from "shared/utility/types"
import { SystemCall } from "../system_call"
import { checkMemoryIntegrity } from "../utility/types"

type UniqueIdMemory = {
  uniqueIdIndex: number
}

const initializeMemory = (rawMemory: unknown): UniqueIdMemory => {
  const memory = rawMemory as Mutable<UniqueIdMemory>

  if (memory.uniqueIdIndex == null) {
    memory.uniqueIdIndex = 1
  }

  return memory
}

const radix = 36
let uniqueIdMemory: UniqueIdMemory = initializeMemory({})

type UniqueId = {
  generate(): string
  generateFromInteger(idIndex: number): string
}

export const UniqueId: SystemCall & UniqueId = {
  name: "UniqueId",

  load(memoryReference: unknown): void {
    checkMemoryIntegrity(uniqueIdMemory, initializeMemory, "UniqueId")
    uniqueIdMemory = initializeMemory(memoryReference)
  },

  startOfTick(): void {
  },

  endOfTick(): void {
  },

  // UniqueId
  generate(): string {
    const idIndex = uniqueIdMemory.uniqueIdIndex
    uniqueIdMemory.uniqueIdIndex += 1
    return this.generateFromInteger(idIndex)
  },

  generateFromInteger(idIndex: number): string {
    return idIndex.toString(radix)
  },
}
