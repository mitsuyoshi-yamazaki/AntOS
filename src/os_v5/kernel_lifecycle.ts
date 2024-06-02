export interface KernelLifecycle {
  load(memoryReference: unknown): void
  startOfTick(): void
  endOfTick(): void
}

export type KernelLifecycleMethods = keyof KernelLifecycle
