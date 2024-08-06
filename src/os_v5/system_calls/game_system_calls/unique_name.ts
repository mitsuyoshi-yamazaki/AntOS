
import { Timestamp } from "shared/utility/timestamp"
import { Mutable } from "shared/utility/types"
import { SystemCall } from "../../system_call"
import { UniqueId } from "../unique_id"

const resetInterval = 1501

type OldUniqueNameMemory = {
  uniqueIdIndex: number
  resetTime: Timestamp
}

type UniqueNameMemory = {
  readonly migrated: true
  creep: {
    uniqueIdIndex: number
    resetTime: Timestamp
  }
  flagUniqueIdIndex: number
}

const initializeMemory = (rawMemory: unknown): UniqueNameMemory => {
  const memory = rawMemory as Mutable<UniqueNameMemory>

  if (memory.migrated !== true) {
    const oldMemory = rawMemory as OldUniqueNameMemory

    return {
      migrated: true,
      creep: {
        ...oldMemory,
      },
      flagUniqueIdIndex: 0,
    }
  }

  if (memory.migrated !== true) {
    memory.migrated = true
  }
  if (memory.creep == null) {
    memory.creep = {
      uniqueIdIndex: 1,
      resetTime: Game.time + resetInterval,
    }
  }
  if (memory.flagUniqueIdIndex == null) {
    memory.flagUniqueIdIndex = 0
  }

  return memory
}

let uniqueNameMemory: UniqueNameMemory = {} as UniqueNameMemory

type UniqueName = {
  generateUniqueCreepName(prefix?: string): string
  generateUniqueFlagName(prefix?: string): string
}

export const UniqueName: SystemCall<"UniqueName", UniqueNameMemory> & UniqueName = {
  name: "UniqueName",
  [Symbol.toStringTag]: "UniqueName",

  load(memory: UniqueNameMemory): void {
    uniqueNameMemory = initializeMemory(memory)
  },

  startOfTick(): void {
    if (Game.time >= uniqueNameMemory.creep.resetTime) {
      uniqueNameMemory.creep.uniqueIdIndex = 0
      uniqueNameMemory.creep.resetTime = Game.time + resetInterval
    }
  },

  endOfTick(): UniqueNameMemory {
    return uniqueNameMemory
  },

  // UniqueName
  generateUniqueCreepName(prefix?: string): string {
    const index = uniqueNameMemory.creep.uniqueIdIndex
    uniqueNameMemory.creep.uniqueIdIndex += 1
    const shortName = `${prefix ?? ""}${index.toString(UniqueId.radix)}`

    if (Game.creeps[shortName] != null) {
      return UniqueId.generateTrueUniqueId(prefix)
    }
    return shortName
  },

  generateUniqueFlagName(prefix?: string): string {
    const index = uniqueNameMemory.flagUniqueIdIndex
    uniqueNameMemory.flagUniqueIdIndex += 1
    const shortName = `${prefix ?? ""}${index.toString(UniqueId.radix)}`

    if (Game.flags[shortName] != null) {
      return UniqueId.generateTrueUniqueId(prefix)
    }
    return shortName
  },
}
