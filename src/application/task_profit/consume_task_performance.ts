import { emptyTaskPerformanceState, TaskPerformance, TaskPerformanceState } from "application/task_profit"

type ConsumeTaskPerformanceType = "upgrade" | "build wall"

export interface ConsumeTaskPerformance extends TaskPerformance {
  readonly consumeType: ConsumeTaskPerformanceType
}

export interface ConsumeTaskPerformanceState extends TaskPerformanceState {
  readonly consumeType: ConsumeTaskPerformanceType
}

export function emptyConsumeTaskPerformanceState(consumeType: ConsumeTaskPerformanceType): ConsumeTaskPerformanceState {
  return {
    ...emptyTaskPerformanceState(),
    consumeType,
  }
}
