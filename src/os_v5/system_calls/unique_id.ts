
import type { Mutable } from "shared/utility/types"
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

let uniqueIdMemory: UniqueIdMemory = {} as UniqueIdMemory

type UniqueId = {
  readonly radix: number

  generate(): string
  generateTrueUniqueId(prefix?: string): string
  generateFromInteger(idIndex: number): string
  generateCodename(fixedParameter: string, flexibleParameter: number): string
}

export const UniqueId: SystemCall<"UniqueId", UniqueIdMemory> & UniqueId = {
  name: "UniqueId",
  [Symbol.toStringTag]: "UniqueId",

  radix: 36,

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

  generateTrueUniqueId(prefix?: string): string {
    return [
      prefix == null ? "" : prefix,
      `${Game.time}`,
      this.generate(),
    ].join()
  },

  generateFromInteger(idIndex: number): string {
    return idIndex.toString(this.radix)
  },

  generateCodename(fixedParameter: string, flexibleParameter: number): string {
    const firstIndex = ((fixedParameter.charCodeAt(0) + fixedParameter.length) % (this.radix - 10)) + 10 // 数字から始まらないように
    const secondIndex = flexibleParameter % this.radix
    return `${firstIndex.toString(this.radix)}${secondIndex.toString(this.radix)}`
  },
}
