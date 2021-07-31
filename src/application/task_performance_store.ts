import type { ConsumeTaskPerformanceState } from "./task_profit/consume_task_performance"

export interface TaskPerformanceStore {
  consumePerformance: { [index: string]: ConsumeTaskPerformanceState}
}
