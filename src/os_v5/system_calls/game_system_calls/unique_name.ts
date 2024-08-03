
import { Timestamp } from "shared/utility/timestamp"
import { Mutable } from "shared/utility/types"
import { SystemCall } from "../../system_call"
import { UniqueId } from "../unique_id"

const resetInterval = 1501

type UniqueNameMemory = {
  uniqueIdIndex: number
  resetTime: Timestamp
}

const initializeMemory = (rawMemory: unknown): UniqueNameMemory => {
  const memory = rawMemory as Mutable<UniqueNameMemory>

  if (memory.uniqueIdIndex == null) {
    memory.uniqueIdIndex = 1
  }
  if (memory.resetTime == null) {
    memory.resetTime = Game.time + resetInterval
  }

  return memory
}

let uniqueNameMemory: UniqueNameMemory = {} as UniqueNameMemory

type UniqueName = {
  generate_unique_creep_name(prefix?: string): string
}

export const UniqueName: SystemCall<"UniqueName", UniqueNameMemory> & UniqueName = {
  name: "UniqueName",
  [Symbol.toStringTag]: "UniqueName",

  load(memory: UniqueNameMemory): void {
    uniqueNameMemory = initializeMemory(memory)
  },

  startOfTick(): void {
    if (Game.time >= uniqueNameMemory.resetTime) {
      uniqueNameMemory.uniqueIdIndex = 0
      uniqueNameMemory.resetTime = Game.time + resetInterval
    }
  },

  endOfTick(): UniqueNameMemory {
    return uniqueNameMemory
  },

  // UniqueName
  generate_unique_creep_name(prefix?: string): string {
    const index = uniqueNameMemory.uniqueIdIndex
    uniqueNameMemory.uniqueIdIndex += 1
    const shortName = `${prefix ?? ""}${index.toString(UniqueId.radix)}`

    const creep = Game.creeps[shortName]
    if (creep != null) {
      return UniqueId.generateTrueUniqueId(prefix)
    }
    return shortName
  },
}
