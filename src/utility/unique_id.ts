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
