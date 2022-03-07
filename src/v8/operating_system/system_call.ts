export interface SystemCall<T> {
  beforeTick(args: T): void
  afterTick(): void
}

export type IndependentSystemCall = SystemCall<void>
