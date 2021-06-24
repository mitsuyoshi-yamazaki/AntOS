import { decodeObjectivesFrom, Objective, ObjectiveState } from "task/objective"

export interface BootstrapRoomObjectiveState extends ObjectiveState {
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
export class BootstrapRoomObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
  ) {
  }

  public encode(): BootstrapRoomObjectiveState {
    return {
      t: "BootstrapRoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
    }
  }

  public static decode(state: BootstrapRoomObjectiveState): BootstrapRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new BootstrapRoomObjective(state.s, children)
  }
}

export interface Condition {

}

export interface RoomCondition extends Condition {
  roomName: string

  isVisible: boolean
}
