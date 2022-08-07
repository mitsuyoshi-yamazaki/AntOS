type SystemCallDefaultInterface = {
  load(): void
  startOfTick(): void
  endOfTick(): void
}

export type SystemCall = Partial<SystemCallDefaultInterface> & {
  readonly description: string
}
