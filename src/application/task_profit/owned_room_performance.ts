import { TaskPerformance, TaskPerformanceState } from "application/task_profit"

export interface RoomKeeperPerformanceState extends TaskPerformanceState {

}

export interface RoomKeeperPerformance extends TaskPerformance {

}

export function emptyRoomKeeperPerformanceState(): RoomKeeperPerformanceState {
  return {
    s: [],
    r: [],
  }
}
