export interface KernelLifecycle {
  load(): void
  startOfTick(): void
  endOfTick(): void
}

export type KernelLifecycleMethods = keyof KernelLifecycle
