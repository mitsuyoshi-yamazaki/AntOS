import type { TaskPerformance } from "application/task_profit"

/**
 * - Towerが全て破壊される前に撃退できる
 *   - 敵が攻撃手段を持たないがこちらも打ち破れないという場合も寿命まで粘れば良い
 */
interface OwnedRoomDefenceTaskPerformanceDefeat {
  readonly defencePerformanceType: "defeat"
  readonly timeToDefeat: number
}

/**
 * - 撃退する前にTowerが全て破壊される
 */
interface OwnedRoomDefenceTaskPerformanceFall {
  readonly defencePerformanceType: "fall"
  readonly timeToFallen: number
}

export type OwnedRoomDefenceTaskPerformanceType = OwnedRoomDefenceTaskPerformanceDefeat | OwnedRoomDefenceTaskPerformanceFall
export const OwnedRoomDefenceTaskPerformanceType = {
  Defeat(timeToDefeat: number): OwnedRoomDefenceTaskPerformanceDefeat {
    return {
      defencePerformanceType: "defeat",
      timeToDefeat,
    }
  },
  Fall(timeToFallen: number): OwnedRoomDefenceTaskPerformanceFall {
    return {
      defencePerformanceType: "fall",
      timeToFallen,
    }
  },
}

export interface OwnedRoomDefenceTaskPerformance extends TaskPerformance {
  readonly type: OwnedRoomDefenceTaskPerformanceType

  /** Spawn, Tower, Storage, Terminal等重要施設にダメージが入るまでの時間 */
  readonly timeToCriticalDamage: number | "never"
}
