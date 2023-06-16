export type SystemCall = {
  load(): void
  startOfTick(): void
  endOfTick(): void
}
