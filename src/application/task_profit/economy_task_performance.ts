import type { TaskPerformance, TaskPerformanceState } from "application/task_profit"

export interface EconomyTaskPerformance extends TaskPerformance {
  readonly resourceProfit: Map<ResourceConstant, number>
}

export interface EconomyTaskPerformanceState extends TaskPerformanceState {

}
