import { SystemCall } from "./system_call"

/**
 * - DriverはOSの稼働に必須ではないため、初期化を遅延することが可能
 */
export interface Driver<T> extends SystemCall<T> {
  load(): void
}

export type IndependentDriver = Driver<void>
