import { Problem, ProblemIdentifier } from "objective/problem"
import { CreepRole } from "prototype/creep"
import { RoomName } from "prototype/room"
import { CreepInsufficiencyProblemSolver } from "./creep_insufficiency_problem_solver"

export class CreepInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public problemSolver: CreepInsufficiencyProblemSolver

  public constructor(
    public readonly roomName: RoomName,
    public readonly role: CreepRole,
  ) {
    this.identifier = `${this.constructor.name}_${roomName}_${role}`
    this.problemSolver = new CreepInsufficiencyProblemSolver(roomName, role)
  }
}
