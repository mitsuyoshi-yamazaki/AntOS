import { Problem, ProblemIdentifier } from "objective/problem"
import { CreepRole } from "prototype/creep"
import { RoomName } from "prototype/room"
import { CreepInsufficiencyProblemSolver } from "./creep_insufficiency_problem_solver"

export class CreepInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public problemSolver: CreepInsufficiencyProblemSolver

  public constructor(
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
  ) {
    this.identifier = `${this.constructor.name}_${roomName}_${roles.join(",")}`
    this.problemSolver = new CreepInsufficiencyProblemSolver(roomName, roles)
  }
}
