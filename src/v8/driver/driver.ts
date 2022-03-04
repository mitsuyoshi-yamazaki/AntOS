export interface Driver {
  beforeTick(): void
  afterTick(): void
}
