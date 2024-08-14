import { ConsoleUtility } from "../../utility/console_utility/console_utility"
import { SerializableObject } from "../../utility/serializable_types"

/**
# InterShardMemory
## 概要
- OSやBIOSのInterShardMemory操作を統合する

## 仕様
- そのtickでInterShardMemoryの変更があった場合のみserializeする
 */


type InterShardMemoryContent = Record<string, SerializableObject>

let parsedInterShardMemory: InterShardMemoryContent | null = null
let changed = false
const otherShardMemories = new Map<string, InterShardMemoryContent | null>()


export const InterShardMemoryManager = {
  startOfTick(): void {
    parsedInterShardMemory = null
    changed = false
    otherShardMemories.clear()
  },

  endOfTick(): void {
    if (parsedInterShardMemory == null || changed !== true) {
      return
    }
    setInterShardMemory(parsedInterShardMemory)
  },
}


export const InterShardMemoryAccessor = {
  hasChangesInTick(): boolean {
    return parsedInterShardMemory != null && changed === true
  },

  getInterShardMemory<M extends SerializableObject>(namespace: string): M {
    if (parsedInterShardMemory == null) {
      parsedInterShardMemory = parseInterShardMemory()
    }

    const localMemory = parsedInterShardMemory as Record<string, M>

    const memory = localMemory[namespace]
    if (memory != null) {
      return memory
    }
    const emptyMemory = {} as M
    parsedInterShardMemory[namespace] = emptyMemory
    return emptyMemory
  },

  setInterShardMemory<M extends SerializableObject>(namespace: string, memory: M): void {
    if (parsedInterShardMemory == null) {
      parsedInterShardMemory = parseInterShardMemory()
    }

    parsedInterShardMemory[namespace] = memory
    changed = true
  },

  getOtherShardMemory<M extends SerializableObject>(shardName: string, namespace: string): M | null {
    const typedOtherShardMemories = otherShardMemories as Map<string, Record<string, M> | null>

    if (typedOtherShardMemories.has(shardName) === false) {
      const parsedMemory = parseOtherShardMemory(shardName) as Record<string, M> | null
      typedOtherShardMemories.set(shardName, parsedMemory)

      if (parsedMemory == null) {
        return null
      }
      return parsedMemory[namespace] ?? null
    }

    const stored = typedOtherShardMemories.get(shardName)
    if (stored == null) {
      return null
    }
    return stored[namespace] ?? null
  },
}


const parseInterShardMemory = (): InterShardMemoryContent => {
  const rawMemory = InterShardMemory.getLocal()
  try {
    return JSON.parse(rawMemory)
  } catch (error) {
    console.log(ConsoleUtility.colored(`InterShardMemory parse memory failed: ${error}`, "error"))
    return {}
  }
}

const parseOtherShardMemory = (shardName: string): InterShardMemoryContent | null => {
  try {
    const rawMemory = InterShardMemory.getRemote(shardName)
    if (rawMemory == null) {
      return null
    }

    try {
      return JSON.parse(rawMemory)
    } catch (error) {
      console.log(ConsoleUtility.colored(`InterShardMemory parse remote memory failed: ${error}`, "error"))
      return {}
    }

  } catch (error) {
    console.log(ConsoleUtility.colored(`InterShardMemory parse remote memory failed: ${error}`, "error"))
    return null
  }
}

const setInterShardMemory = (memory: InterShardMemoryContent): void => {
  try {
    InterShardMemory.setLocal(JSON.stringify(memory))
  } catch (error) {
    console.log(ConsoleUtility.colored(`InterShardMemory set memory failed: ${error}`, "error"))
  }
}
