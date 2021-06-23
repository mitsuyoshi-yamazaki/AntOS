import { decodeObjectiveFrom, Objective, ObjectiveState } from "task/objective"

export interface SignRoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string[]

  /** sign mark */
  m: string

  /** base room name */
  b: string

  /** creep id */
  cr: string | null
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
    public readonly baseRoomName: string,
    private creepId: string | null,
  ) {
  }

  public run(): void {

  }

  public encode(): SignRoomObjectiveState {
    return {
      s: this.startTime,
      t: "SignRoomObjective",
      c: this.children.map(child => child.encode()),
      r: this.targetRoomNames,
      m: this.mark,
      b: this.baseRoomName,
      cr: this.creepId,
    }
  }

  public static decode(state: SignRoomObjectiveState): SignRoomObjective {
    const children = state.c.flatMap(childState => decodeObjectiveFrom(childState) ?? [])
    return new SignRoomObjective(state.s, children, state.r, state.m, state.b, state.cr)
  }

  public objectiveDescription(): string {
    const baseDescription = `- mark: ${this.mark}\n- target rooms: ${this.targetRoomNames}\n- child objectives: `
    if (this.children.length <= 0) {
      return `${baseDescription}none`
    }
    const childObjectivesDescription = this.children.reduce((result, child) => {
      return `${result}\n  - ${child.constructor.name}`
    }, "")
    return `${baseDescription}${childObjectivesDescription}`
  }
}
