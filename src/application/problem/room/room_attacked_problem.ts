import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"

export class RoomAttackedProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly room: Room,
  ) {
    this.identifier = `${this.constructor.name}_${this.room.name}`
  }
}
