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

export function generateUniqueCodename(fixedParameter: string, flexibleParameter: number): string {
  const adjectiveIndex = (fixedParameter.charCodeAt(0) + fixedParameter.length) % adjectives.length
  const sweetIndex = flexibleParameter % sweets.length
  return `${adjectives[adjectiveIndex]}_${sweets[sweetIndex]}`
}
