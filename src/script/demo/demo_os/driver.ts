export type Driver = {
  load(): void
  startOfTick(): void
  endOfTick(): void
}

export type CpuDriver = Driver & {
  //
}

export type MemoryDriver = Driver & {
  //
}
