import type { TaskPerformance, TaskPerformancePeriodType, TaskPerformanceState } from "application/task_profit"
import { Timestamp } from "utility/timestamp"

type ConsumeTaskPerformanceProfitUpgrade = {
  targetType: "upgrade"
  energySpent: number
}

type ConsumeTaskPerformanceProfitWall = {
  targetType: "wall"
  energySpent: number
}

export type ConsumeTaskPerformanceProfitType = ConsumeTaskPerformanceProfitUpgrade
  | ConsumeTaskPerformanceProfitWall

export interface ConsumeTaskPerformance extends TaskPerformance {
  // readonly targetType: ConsumeTaskPerformanceProfitType  // TODO:
}

export interface ConsumeTaskPerformanceState extends TaskPerformanceState {

}

export function emptyConsumeTaskPerformanceState(): ConsumeTaskPerformanceState {
  return {
    s: [],
    r: [],
  }
}

export function calculateConsumeTaskPerformance(period: Timestamp, periodType: TaskPerformancePeriodType, state: ConsumeTaskPerformanceState): ConsumeTaskPerformance {
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
