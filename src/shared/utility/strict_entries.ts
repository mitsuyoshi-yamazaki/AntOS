type AnyReversibleRecord = Record<string | number, string | number>

export type ReversedMapping<T extends AnyReversibleRecord> = {
  [K in keyof T as T[K]]: K
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const strictEntries = <T extends Record<string | number, any>>(object: T): [keyof T, T[keyof T]][] => {
  return Object.entries(object)
}

export const reverseConstMapping = <T extends AnyReversibleRecord>(mapping: T): ReversedMapping<T> => {
  return Object.fromEntries(strictEntries(mapping).map(([key, value]) => [value, key])) as ReversedMapping<T>
}
