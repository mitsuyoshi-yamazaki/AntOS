import { decodeObjectivesFrom, Objective, ObjectiveState } from "task/objective"

export interface BootstrapRoomObjectiveState extends ObjectiveState {
}

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
