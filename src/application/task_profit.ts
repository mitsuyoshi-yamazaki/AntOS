import type { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { Timestamp } from "utility/timestamp"

export type TaskPerformancePeriodType = "one time" | "continuous"

export interface TaskPerformance {
  readonly periodType: TaskPerformancePeriodType
  readonly timeSpent: Timestamp
  readonly spawnTime: Timestamp
  readonly numberOfCreeps: number
  readonly resourceCost: Map<ResourceConstant, number>
}

/**
 * - performance()を実装したい
 *   - 具象のTaskPerformanceStateを参照する必要がある
 *   - 具象のTaskPerformanceStateをどのように抽象クラスで指定するか
 */
export interface TaskProfit<Performance extends TaskPerformance, PerformanceState extends TaskPerformanceState> {
  performanceState: PerformanceState

  estimate(roomResource: OwnedRoomResource): Performance
  performance(period: Timestamp): Performance
}

export interface TaskPerformanceState {
  /** spawn time */
  s: {
    /** timestamp */
    t: Timestamp

    /** spawn time */
    st: number
  }[]

  /** resource cost */
  r: {
    /** timestamp */
    t: Timestamp

    /** resource type */
    r: ResourceConstant

    /** amount */
    a: number
  }[]
}
