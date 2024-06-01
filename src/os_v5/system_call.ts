/**
# システムコール
 */

export interface SystemCall {
  load(): void
  startOfTick(): void
  endOfTick(): void
}
