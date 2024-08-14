import { SerializableObject } from "shared/utility/serializable_types"

export type BiosFunction<Name extends string, MemoryType extends SerializableObject> = {
  readonly name: Name
  readonly [Symbol.toStringTag]: Name

  load(memory: MemoryType): void
  startOfTick(): void
  endOfTick(): MemoryType
}
