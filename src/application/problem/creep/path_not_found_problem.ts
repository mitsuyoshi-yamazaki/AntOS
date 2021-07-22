import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"

export class PathNotFoundProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly position: RoomPosition,
    public readonly destination: RoomPosition
  ) {
    this.identifier = `${this.constructor.name}_${this.position.id}_${this.destination.id}`
  }
}
