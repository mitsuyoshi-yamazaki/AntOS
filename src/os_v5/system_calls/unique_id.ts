
import { Mutable } from "shared/utility/types"
import { SystemCall } from "../system_call"

type UniqueIdMemory = {
  uniqueIdIndex: number
}

const initializeMemory = (memory: UniqueIdMemory): UniqueIdMemory => {
  const mutableMemroy = memory as Mutable<UniqueIdMemory>

  if (mutableMemroy.uniqueIdIndex == null) {
    mutableMemroy.uniqueIdIndex = 1
  }

  return mutableMemroy
}

const radix = 36
let uniqueIdMemory: UniqueIdMemory = {} as UniqueIdMemory

type UniqueId = {
  generate(): string
  generateFromInteger(idIndex: number): string
}

export const UniqueId: SystemCall<"UniqueId", UniqueIdMemory> & UniqueId = {
  name: "UniqueId",
  [Symbol.toStringTag]: "UniqueId",

  load(memory: UniqueIdMemory): void {
    uniqueIdMemory = initializeMemory(memory)
  },

  startOfTick(): void {
  },

  endOfTick(): UniqueIdMemory {
    return uniqueIdMemory
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
