import { emptyTaskPerformanceState, TaskPerformance, TaskPerformanceState } from "application/task_profit"

export interface DefenceTaskPerformance extends TaskPerformance {
  // TODO:
}

export interface DefenceTaskPerformanceState extends TaskPerformanceState {
}

export function emptyDefenceTaskPerformanceState(): DefenceTaskPerformanceState {
  return {
    ...emptyTaskPerformanceState(),
  }
}
