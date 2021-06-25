import { decodeObjectivesFrom, Objective, ObjectiveState } from "task/objective"

export interface BootstrapL8RoomObjectiveState extends ObjectiveState {
}

/**
 * - 切り出してClaimRoomObjectiveを実装する
 * - State判定 -> Next Action
 * - failする条件を潰していくことがロジックの成長につながる
 * - 条件(condition)は処理を持たない情報
 * - bootstrap (goal: Lv1 room controller & minimum upgrader)
 *   - room
 *     - invisible -> fail
 *     - visible
 *       - controller
 *         - null -> fail
 *         - exists
 *           - owner
 *             - exists -> fail
 *             - null
 *               - send claimer & claim
 *                 - not succeed -> fail
 *                 - success
 */
export class BootstrapL8RoomObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
  ) {
  }

  public encode(): BootstrapL8RoomObjectiveState {
    return {
      t: "BootstrapL8RoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
    }
  }

  public static decode(state: BootstrapL8RoomObjectiveState): BootstrapL8RoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new BootstrapL8RoomObjective(state.s, children)
  }
}
