import { emptyTaskPerformanceState, TaskPerformance, TaskPerformanceState } from "application/task_profit"

type ConsumeTaskPerformanceTypeUpgrade = {
  targetType: "upgrade"
  energySpent: number
}
type ConsumeTaskPerformanceTypeRepairWall = {
  targetType: "wall"
  energySpent: number
}

export type ConsumeTaskPerformanceType = ConsumeTaskPerformanceTypeUpgrade
  | ConsumeTaskPerformanceTypeRepairWall

export interface ConsumeTaskPerformance extends TaskPerformance {
  // readonly task: ConsumeTaskPerformanceType
}

export interface ConsumeTaskPerformanceState extends TaskPerformanceState {

}

export function emptyConsumeTaskPerformanceState(): ConsumeTaskPerformanceState {
  return {
    ...emptyTaskPerformanceState(),
  }
}
