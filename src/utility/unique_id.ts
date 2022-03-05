let uniqueIdIndex = 0
export function generateUniqueId(prefix?: string): string {
  uniqueIdIndex += 1
  const components: string[] = [
    `${Game.time.toString(16)}${uniqueIdIndex.toString(16)}`,
  ]
  if (prefix != null) {
    components.unshift(prefix)
  }
  return components.join("_")
}

const adjectives: string[] = [
  "melon",
  "strawberry",
  "banana",
  "chocolate",
  "cheese",
  "belgian",
  "baked",
  "matcha",
  "gecko",  // 🦎
]

const sweets: string[] = [
  "parfait",
  "tart",
  "cake",
  "cookie",
  "waffles",
  "pudding",
  "jelly",
  "icecream",
  "beer", // 🍻
]

const alphabet = "abcdefghijklmnopqrstuvwxyg"

export function generateCodename(fixedParameter: string, flexibleParameter: number): string {
  // if (Game.shard.name !== "shard3") { // TODO: 全展開する
  //   const adjectiveIndex = (fixedParameter.charCodeAt(0) + fixedParameter.length) % adjectives.length
  //   const sweetIndex = flexibleParameter % sweets.length
  //   return `${adjectives[adjectiveIndex]}_${sweets[sweetIndex]}`
  // }
  const firstIndex = (fixedParameter.charCodeAt(0) + fixedParameter.length) % alphabet.length
  const secondIndex = flexibleParameter % alphabet.length
  return `${alphabet[firstIndex]}${alphabet[secondIndex]}`
}
