import type { TaskPerformance, TaskPerformancePeriodType, TaskPerformanceState } from "application/task_profit"
import { Timestamp } from "utility/timestamp"

export interface ObserveTaskPerformance extends TaskPerformance {
  /**
   * - 対象の部屋の数
   *   - Season3FindPowerBankTaskではPowerBankの出現可能性のある部屋の数
   */
  readonly observedRooms: number
}

export interface ObserveTaskPerformanceState extends TaskPerformanceState {
  /** observed rooms */
  o: {[index: string]: number}  // [index: RoomName]: last observed time
}

export function emptyObserveTaskPerformanceState(): ObserveTaskPerformanceState {
  return {
    s: [],
    r: [],
    o: {},
  }
}

export function calculateObserveTaskPerformance(period: Timestamp, periodType: TaskPerformancePeriodType, state: ObserveTaskPerformanceState): ObserveTaskPerformance {
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

  let observedRooms = 0
  for (const roomName in state.o) {
    const observedTime = state.o[roomName]
    if (observedTime < fromTimestamp) {
      continue
    }
    observedRooms += 1
  }

  return {
    periodType,
    timeSpent: period,
    spawnTime,
    numberOfCreeps,
    resourceCost,
    observedRooms,
  }
}
