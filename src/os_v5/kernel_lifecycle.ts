import { AnySerializable } from "shared/utility/serializable_types"

export interface KernelLifecycle<MemoryType extends AnySerializable> {
  load(memory: MemoryType): void
  startOfTick(): void
  endOfTick(): MemoryType
  run?(): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type KernelLifecycleMethods = keyof KernelLifecycle<AnySerializable>
