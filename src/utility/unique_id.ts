import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { GameConstants } from "./constants"

export type UniqueIdMemory = {
  creepNameIndex: number
}

const radix = 36
let uniqueIdIndex = 0 // TODO: Game.timeとconcatしているのでafterTickで初期化できる
let creepNameIndex = 0
let creepNameIndexResetTimestamp = Game.time
const creepNameIndexResetInterval = GameConstants.creep.life.lifeTime + 200

export const UniqueId = {
  load(): void {
    creepNameIndex = Memory.uniqueId.creepNameIndex
  },

  beforeTick(): void {
    uniqueIdIndex = 0

    if (Game.time >= creepNameIndexResetTimestamp + creepNameIndexResetInterval) {
      creepNameIndex = 0
      creepNameIndexResetTimestamp = Game.time
    }
  },

  afterTick(): void {
    Memory.uniqueId.creepNameIndex = creepNameIndex
  },

  generate(prefix?: string): string {
    return generateUniqueId(prefix)
  },

  generateCodename(fixedParameter: string, flexibleParameter: number): string {
    return generateCodename(fixedParameter, flexibleParameter)
  },

  generateCreepName(prefix: string): string {
    const index = creepNameIndex
    creepNameIndex += 1
    const shortName = `${prefix}${index.toString(radix)}`

    const creep = Game.creeps[shortName]
    if (creep != null) {
      PrimitiveLogger.programError(`UniqueId.generateCreepName() duplicated name ${shortName} (${(creep.memory as {i?: string}).i})`)
      return this.generate(prefix)
    }
    return shortName
  },
}

/** @deprecated UniqueId.generate()を使用 */
export function generateUniqueId(prefix?: string): string {
  uniqueIdIndex += 1
  const components: string[] = [
    `${Game.time.toString(radix)}${uniqueIdIndex.toString(radix)}`,
  ]
  if (prefix != null) {
    components.unshift(prefix)
  }
  return components.join("")
}

// const adjectives: string[] = [
//   "melon",
//   "strawberry",
//   "banana",
//   "chocolate",
//   "cheese",
//   "belgian",
//   "baked",
//   "matcha",
//   "gecko",  // 🦎
// ]

// const sweets: string[] = [
//   "parfait",
//   "tart",
//   "cake",
//   "cookie",
//   "waffles",
//   "pudding",
//   "jelly",
//   "icecream",
//   "beer", // 🍻
// ]

/** @deprecated UniqueId.generateCodename()を使用 */
export function generateCodename(fixedParameter: string, flexibleParameter: number): string {
  //   const adjectiveIndex = (fixedParameter.charCodeAt(0) + fixedParameter.length) % adjectives.length
  //   const sweetIndex = flexibleParameter % sweets.length
  //   return `${adjectives[adjectiveIndex]}_${sweets[sweetIndex]}`
  const firstIndex = (fixedParameter.charCodeAt(0) + fixedParameter.length) % radix
  const secondIndex = flexibleParameter % radix
  return `${firstIndex.toString(radix)}${secondIndex.toString(radix)}`
}
