import { decodeObjectiveFrom, Objective, ObjectiveState } from "task/objective"

export interface SignRoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string[]

  /** sign mark */
  m: string
}

/**
 * - 指定されたRoomsにsignする
 *   - W53S28,W53S29,W54S28,W54S29
 * - 自分のsignであってもmarkが含まれていない場合は上書きする
 */
export class SignRoomObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly targetRoomNames: string[],
    public readonly mark: string,
  ) {

  }

  public run(): void {

  }

  // ---- Stateful ---- //
  public encode(): SignRoomObjectiveState {
    return {
      s: this.startTime,
      t: "SignRoomObjective",
      c: this.children.map(child => child.encode()),
      r: this.targetRoomNames,
      m: this.mark,
    }
  }

  public static decode(state: SignRoomObjectiveState): SignRoomObjective | null {
    const children = state.c.flatMap(childState => decodeObjectiveFrom(childState) ?? [])
    return new SignRoomObjective(state.s, children, state.r, state.m)
  }
}
