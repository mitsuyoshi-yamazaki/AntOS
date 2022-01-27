import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"

export class UnexpectedProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public readonly shouldNotify = true

  public constructor(
    public readonly problem: Problem,
  ) {
    this.identifier = this.problem.identifier
  }
}
