let uniqueIdIndex = 0
export function generateUniqueId(prefix?: string): string {
  uniqueIdIndex += 1
  return `${prefix ?? ""}${Game.time.toString(16)}${uniqueIdIndex.toString(16)}`
}
