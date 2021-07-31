import type { TaskPerformance, TaskPerformancePeriodType, TaskPerformanceState } from "application/task_profit"
import { Timestamp } from "utility/timestamp"

export interface EconomyTaskPerformance extends TaskPerformance {
  // readonly resourceProfit: { [resource in ResourceConstant]?: number }
}

export interface EconomyTaskPerformanceState extends TaskPerformanceState {
  // resourceProfit: {[resource in ResourceConstant]?: number}  // TODO: 時系列にする // そもそも得たのはどのタイミングか
}

export function emptyEconomyTaskPerformanceState(): EconomyTaskPerformanceState {
  return {
    s: [],
    r: [],
    // resourceProfit: {},
  }
}

export function calculateEconomyTaskPerformance(period: Timestamp, periodType: TaskPerformancePeriodType, state: EconomyTaskPerformanceState): EconomyTaskPerformance {
  const fromTimestamp = Game.time - period

  let spawnTime = 0
  let numberOfCreeps = 0

  state.s.forEach(spawnInfo => {
    if (spawnInfo.t < fromTimestamp) {
      return
    }
    spawnTime += spawnInfo.st
    numberOfCreeps += 1
  })

  const resourceCost = new Map<ResourceConstant, number>()
  state.r.forEach(resourceInfo => {
    if (resourceInfo.t < fromTimestamp) {
      return
    }
    const stored = resourceCost.get(resourceInfo.r) ?? 0
    resourceCost.set(resourceInfo.r, stored + resourceInfo.a)
  })

  return {
    periodType,
    timeSpent: period,
    spawnTime,
    numberOfCreeps,
    resourceCost,
  }
}
