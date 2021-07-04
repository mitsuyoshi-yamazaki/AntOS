import { Problem, ProblemIdentifier } from "objective/problem"
import { ProblemSolver } from "objective/problem_solver"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { CreepInsufficiencyProblemSolver } from "./creep_insufficiency_problem_solver"

export class CreepInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
  ) {
    this.identifier = `${this.constructor.name}_${roomName}_${roles.join("_")}`
  }

  public getProblemSolvers(): ProblemSolver[] {
    return [
      CreepInsufficiencyProblemSolver.create(this.identifier, this.roomName, this.roles)
    ]
  }
}
