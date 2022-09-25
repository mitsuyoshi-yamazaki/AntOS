export const strictEntries = <T extends Record<string, any>>(object: T): [keyof T, T[keyof T]][] => {
  return Object.entries(object)
}
