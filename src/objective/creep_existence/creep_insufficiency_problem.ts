import { Problem, ProblemIdentifier } from "objective/problem"
import { ProblemSolver } from "objective/problem_solver"
import { RoomName } from "prototype/room"
import { CreepSpawnRequest } from "world_info/resource_pool/creep_specs"
import { CreepInsufficiencyProblemSolver } from "./creep_insufficiency_problem_solver"

export class CreepInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly roomName: RoomName,
    private readonly request: CreepSpawnRequest,
  ) {
    const descriptions = [
      this.constructor.name,
      this.request.parentRoomName ?? this.roomName,
      this.request.roles.join(","),
    ]
    if (this.request.taskRunnerIdentifier != null) {
      descriptions.push(this.request.taskRunnerIdentifier)
    }
    this.identifier = descriptions.join("_")
  }

  public getProblemSolvers(): ProblemSolver[] {
    return [
      CreepInsufficiencyProblemSolver.create(this.identifier, this.roomName, this.request)
    ]
  }
}
