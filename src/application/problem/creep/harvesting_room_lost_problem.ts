import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"

export class HarvestingRoomLostProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly source: Source,
  ) {
    this.identifier = `${this.constructor.name}_${this.source.room.name}`
  }
}
