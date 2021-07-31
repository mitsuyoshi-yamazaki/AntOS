import { emptyTaskPerformanceState, TaskPerformance, TaskPerformanceState } from "application/task_profit"

export interface InfrastructureTaskPerformance extends TaskPerformance {
}

export interface InfrastructureTaskPerformanceState extends TaskPerformanceState {
}

export function emptyInfrastructureTaskPerformanceState(): InfrastructureTaskPerformanceState {
  return {
    ...emptyTaskPerformanceState(),
  }
}
