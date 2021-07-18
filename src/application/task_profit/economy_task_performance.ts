import type { TaskPerformance } from "application/task_profit"

export interface EconomyTaskPerformance extends TaskPerformance {
  readonly resourceProfit: Map<ResourceConstant, number>
}
