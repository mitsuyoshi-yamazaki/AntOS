import type { TaskPerformance, TaskPerformanceState } from "application/task_profit"

interface ConsumeTaskPerformanceTargetKeepController {
  targetType: "keep controller"
}

interface ConsumeTaskPerformanceTargetUpgrade {
  targetType: "upgrade"
}

export type ConsumeTaskPerformanceTargetType = ConsumeTaskPerformanceTargetKeepController | ConsumeTaskPerformanceTargetUpgrade

export interface ConsumeTaskPerformance extends TaskPerformance {
  readonly targetType: ConsumeTaskPerformanceTargetType
}

export interface ConsumeTaskPerformanceState extends TaskPerformanceState {

}

export function emptyConsumeTaskPerformanceState(): ConsumeTaskPerformanceState {
  return {
    s: [],
    r: [],
  }
}
