import type { TaskPerformance, TaskPerformancePeriodType, TaskPerformanceState } from "application/task_profit"
import { Timestamp } from "utility/timestamp"

export interface DefenceTaskPerformance extends TaskPerformance {
  // TODO:
}

export interface DefenceTaskPerformanceState extends TaskPerformanceState {
}

export function emptyDefenceTaskPerformanceState(): DefenceTaskPerformanceState {
  return {
    s: [],
    r: [],
  }
}

export function calculateDefenceTaskPerformance(period: Timestamp, periodType: TaskPerformancePeriodType, state: DefenceTaskPerformanceState): DefenceTaskPerformance {
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
