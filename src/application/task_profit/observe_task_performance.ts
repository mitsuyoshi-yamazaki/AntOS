import type { TaskPerformance } from "application/task_profit"

export interface ObserveTaskPerformance extends TaskPerformance {
  readonly observedRooms: number
}

export function emptyObserveTaskPerformance(): ObserveTaskPerformance {
  return {
    timeSpent: 0,
    spawnTime: 0,
    numberOfCreeps: 0,
    resourceCost: new Map<ResourceConstant, number>(),
    observedRooms: 0,
  }
}
