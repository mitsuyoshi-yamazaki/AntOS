import { decodeObjectivesFrom, Objective, ObjectiveState } from "task/objective"

export interface ClaimRoomObjectiveState extends ObjectiveState {
  /** target room name */
  r: string

  /** parent room name */
  p: string
}

export class ClaimRoomObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly targetRoomName: string,
    public readonly parentRoomName: string,
  ) {
  }

  public encode(): ClaimRoomObjectiveState {
    return {
      t: "ClaimRoomObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      r: this.targetRoomName,
      p: this.parentRoomName,
    }
  }

  public static decode(state: ClaimRoomObjectiveState): ClaimRoomObjective {
    const children = decodeObjectivesFrom(state.c)
    return new ClaimRoomObjective(state.s, children, state.r, state.p)
  }
}

export interface Condition {

}

export interface RoomCondition extends Condition {
  roomName: string

  isVisible: boolean
}
