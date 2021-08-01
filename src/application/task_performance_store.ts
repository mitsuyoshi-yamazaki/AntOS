import type { ConsumeTaskPerformanceState } from "./task_profit/consume_task_performance"

export interface TaskPerformanceStoreMemory { // index: TaskIdentifier
  consumePerformance: { [index: string]: ConsumeTaskPerformanceState}
}

export const TaskPerformanceStore = {

}
