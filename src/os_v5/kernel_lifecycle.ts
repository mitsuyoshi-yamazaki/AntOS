export interface KernelLifecycle {
  load(memoryReference: unknown): void
  startOfTick(): void
  endOfTick(): void
  run?(): void
}

export type KernelLifecycleMethods = keyof KernelLifecycle
