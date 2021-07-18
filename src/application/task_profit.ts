export interface TaskPerformance {
  readonly timeSpent: number
  readonly spawnTime: number
  readonly numberOfCreeps: number
  readonly resourceCost: Map<ResourceConstant, number>
}

export interface TaskProfit<Performance extends TaskPerformance> {
  readonly estimate: Performance
  readonly performance: Performance
}

export interface TaskPerformanceState {
  /** start time */
  readonly s: number

  /** performance state */
  readonly p: {
    /** spawn time */
    s: number

    /** number of creeps */
    n: number

    /** resource cost */
    r: {[index: string]: number}
  }
}
