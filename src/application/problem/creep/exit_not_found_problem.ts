import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"

export class ExitNotFoundProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly position: RoomPosition,
    public readonly exit: ExitConstant
  ) {
    this.identifier = `${this.constructor.name}_${this.position.id}_${this.exit}`
  }
}
