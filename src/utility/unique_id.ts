let uniqueIdIndex = 0 // TODO: Game.timeとconcatしているのでafterTickで初期化できる
const radix = 36

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

export function generateCodename(fixedParameter: string, flexibleParameter: number): string {
  //   const adjectiveIndex = (fixedParameter.charCodeAt(0) + fixedParameter.length) % adjectives.length
  //   const sweetIndex = flexibleParameter % sweets.length
  //   return `${adjectives[adjectiveIndex]}_${sweets[sweetIndex]}`
  const firstIndex = (fixedParameter.charCodeAt(0) + fixedParameter.length) % radix
  const secondIndex = flexibleParameter % radix
  return `${firstIndex.toString(radix)}${secondIndex.toString(radix)}`
}
