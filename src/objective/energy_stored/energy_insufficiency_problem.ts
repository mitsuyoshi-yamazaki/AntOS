import { CreepInsufficiencyProblemSolver } from "objective/creep_existence/creep_insufficiency_problem_solver"
import { Problem, ProblemIdentifier } from "objective/problem"
import { CreepRole } from "prototype/creep"
import { RoomName } from "prototype/room"

export class EnergyInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public readonly problemSolver: CreepInsufficiencyProblemSolver

  public constructor(
    public readonly roomName: RoomName,
  ) {
    this.identifier = `${this.constructor.name}_${roomName}`
    this.problemSolver = new CreepInsufficiencyProblemSolver(roomName, [CreepRole.EnergyStore, CreepRole.Mover])  // TODO: この解法で良いのか
  }
}
