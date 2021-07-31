import { emptyTaskPerformanceState, TaskPerformance, TaskPerformanceState } from "application/task_profit"

export interface ObserveTaskPerformance extends TaskPerformance {
  /**
   * - 対象の部屋の数
   *   - Season3FindPowerBankTaskではPowerBankの出現可能性のある部屋の数
   */
  readonly observedRooms: number
}

export interface ObserveTaskPerformanceState extends TaskPerformanceState {
  observedRooms: {[index: string]: number}  // [index: RoomName]: last observed time
}

export function emptyObserveTaskPerformanceState(): ObserveTaskPerformanceState {
  return {
    ...emptyTaskPerformanceState(),
    observedRooms: {},
  }
}
