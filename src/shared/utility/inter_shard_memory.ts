/**
# InterShardMemory
## 概要
- OSやBIOSのInterShardMemory操作を統合する

## 仕様
- そのtickでInterShardMemoryの変更があった場合のみserializeする
 */

import { ConsoleUtility } from "./console_utility/console_utility"
import { SerializableObject } from "./serializable_types"

type InterShardMemoryContent = Record<string, SerializableObject>

let parsedInterShardMemory: InterShardMemoryContent | null
let changed = false


export const InterShardMemoryManager = {
  startOfTick(): void {
    parsedInterShardMemory = null
    changed = false
  },

  endOfTick(): void {
    if (parsedInterShardMemory == null || changed !== true) {
      return
    }
    setInterShardMemory(parsedInterShardMemory)
  },
}


export const InterShardMemoryAccessor = {
  hasChanges(): boolean {
    return parsedInterShardMemory != null && changed === true
  },

  getInterShardMemory<M extends SerializableObject>(namespace: string): M {
    if (parsedInterShardMemory == null) {
      parsedInterShardMemory = parseInterShardMemory()
    }

    const memory = parsedInterShardMemory[namespace]
    if (memory == null) {
      const emptyMemory = {} as M
      parsedInterShardMemory[namespace] = emptyMemory
      return emptyMemory
    }
    return memory as M
  },

  setInterShardMemory<M extends SerializableObject>(namespace: string, memory: M): void {
    if (parsedInterShardMemory == null) {
      parsedInterShardMemory = parseInterShardMemory()
    }

    parsedInterShardMemory[namespace] = memory
    changed = true
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

const setInterShardMemory = (memory: InterShardMemoryContent): void => {
  try {
    InterShardMemory.setLocal(JSON.stringify(memory))
  } catch (error) {
    console.log(ConsoleUtility.colored(`InterShardMemory set memory failed: ${error}`, "error"))
  }
}
