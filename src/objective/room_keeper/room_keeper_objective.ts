import { decodeObjectivesFrom, Objective, ObjectiveState } from "objective/objective"

export interface RoomKeeperObjectiveState extends ObjectiveState {

}

export class RoomKeeperObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
  ) { }

  public encode(): RoomKeeperObjectiveState {
    return {
      t: "RoomKeeperObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
    }
  }

  public static decode(state: RoomKeeperObjectiveState): RoomKeeperObjective {
    const children = decodeObjectivesFrom(state.c)
    return new RoomKeeperObjective(state.s, children)
  }
}
