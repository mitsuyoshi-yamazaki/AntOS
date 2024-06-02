
import { lazyLoad } from "os_v5/utility/types"
import { Mutable } from "shared/utility/types"
import { SystemCall } from "../system_call"

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
let uniqueIdMemory: UniqueIdMemory = lazyLoad<UniqueIdMemory>()

type UniqueId = {
  generate(): string
  generateFromInteger(idIndex: number): string
}

export const UniqueId: SystemCall & UniqueId = {
  name: "UniqueId",

  load(memoryReference: unknown): void {
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
