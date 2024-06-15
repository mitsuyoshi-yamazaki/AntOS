
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

let uniqueNameMemory: UniqueNameMemory = {} as UniqueNameMemory

type UniqueName = {
  generate(): string
}

export const UniqueName: SystemCall<UniqueNameMemory> & UniqueName = {
  name: "UniqueName",

  load(memory: UniqueNameMemory): void {
    uniqueNameMemory = initializeMemory(memory)
  },

  startOfTick(): void {
  },

  endOfTick(): UniqueNameMemory {
    return uniqueNameMemory
  },

  // UniqueId
  generate(): string {
    return "TODO"
  },
}
