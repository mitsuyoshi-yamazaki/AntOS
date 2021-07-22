import { TaskPerformance, TaskPerformanceState } from "application/task_profit"

export interface OwnedRoomPerformanceState extends TaskPerformanceState {

}

export interface OwnedRoomPerformance extends TaskPerformance {

}

export function emptyOwnedRoomPerformanceState(): OwnedRoomPerformanceState {
  return {
    s: [],
    r: [],
  }
}
