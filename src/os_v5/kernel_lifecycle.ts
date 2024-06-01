export interface KernelLifecycle {
  load(memory_reference: unknown): void
  startOfTick(): void
  endOfTick(): void
}

export type KernelLifecycleMethods = keyof KernelLifecycle
