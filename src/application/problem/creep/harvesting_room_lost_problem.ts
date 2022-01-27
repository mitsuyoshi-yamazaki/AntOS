import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"

export class HarvestingRoomLostProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public readonly shouldNotify = true

  public constructor(
    public readonly target: Source | Mineral,
  ) {
    this.identifier = `${this.constructor.name}_${this.target.room?.name}`
  }
}
