import { decodeObjectivesFrom, Objective, ObjectiveState } from "task/objective"

export interface ScoutObserveRoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string

  /** parent room name */
  b: string
}

export class ScoutObserveRoomObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly targetRoomName: string,
    public readonly baseRoomName: string,
  ) {
  }

  public encode(): ScoutObserveRoomObjectiveState {
    return {
      t: "ScoutObserveRoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      r: this.targetRoomName,
      b: this.baseRoomName,
    }
  }

  public static decode(state: ScoutObserveRoomObjectiveState): ScoutObserveRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new ScoutObserveRoomObjective(state.s, children, state.r, state.b)
  }
}
