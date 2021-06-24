import { decodeObjectivesFrom, Objective, ObjectiveState } from "task/objective"

export interface ClaimRoomObjectiveState extends ObjectiveState {
}

export class ClaimRoomObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
  ) {
  }

  public encode(): ClaimRoomObjectiveState {
    return {
      t: "ClaimRoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
    }
  }

  public static decode(state: ClaimRoomObjectiveState): ClaimRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new ClaimRoomObjective(state.s, children)
  }
}

export interface Condition {

}

export interface RoomCondition extends Condition {
  roomName: string

  isVisible: boolean
}
