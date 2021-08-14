import type { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { GameConstants } from "utility/constants"
import type { Timestamp } from "utility/timestamp"

export type TaskPerformancePeriodType = number | "continuous"

export interface TaskPerformance {
  readonly periodType: TaskPerformancePeriodType
  readonly timeSpent: Timestamp
  readonly spawnTime: Timestamp
  readonly numberOfCreeps: number
  readonly resourceCost: Map<ResourceConstant, number>
}

export interface TaskProfit<Performance extends TaskPerformance> {
  estimate(roomResource: OwnedRoomResource): Performance
}

export interface TaskPerformanceState {
  sessionStartTime: Timestamp
  spawnTime: number
  resourceSpent: {[K in ResourceConstant]?: number}
}

const sessionDuration = GameConstants.creep.life.lifeTime * 3
export function taskPerformanceSessionStartTime(): Timestamp {
  return Math.floor(Game.time / sessionDuration) * sessionDuration
}

export function emptyTaskPerformanceState(): TaskPerformanceState {
  return {
    sessionStartTime: Game.time,
    spawnTime: 0,
    resourceSpent: {},
  }
}
