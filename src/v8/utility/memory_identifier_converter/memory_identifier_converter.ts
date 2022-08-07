export interface MemoryIdentifierConverter<T extends string, S extends string> {
  convert(identifier: T): S
  revert(shortIdentifier: S): T
}
