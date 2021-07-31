import { emptyTaskPerformanceState, TaskPerformance, TaskPerformanceState } from "application/task_profit"

export interface EconomyTaskPerformance extends TaskPerformance {
  // readonly resourceProfit: { [resource in ResourceConstant]?: number }
}

export interface EconomyTaskPerformanceState extends TaskPerformanceState {
  // resourceProfit: {[resource in ResourceConstant]?: number}  // TODO: 時系列にする // そもそも得たのはどのタイミングか
}

export function emptyEconomyTaskPerformanceState(): EconomyTaskPerformanceState {
  return {
    ...emptyTaskPerformanceState(),
  }
}
