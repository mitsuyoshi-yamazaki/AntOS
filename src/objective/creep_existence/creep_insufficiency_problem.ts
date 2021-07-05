import { Problem, ProblemIdentifier } from "objective/problem"
import { ProblemSolver } from "objective/problem_solver"
import { TaskRunnerIdentifier } from "objective/task_runner"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { CreepInsufficiencyProblemSolver } from "./creep_insufficiency_problem_solver"

export class CreepInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
    public readonly body: BodyPartConstant[] | null,
    public readonly targetTaskRunnerIdentifier: TaskRunnerIdentifier | null,
  ) {
    this.identifier = `${this.constructor.name}_${roomName}_${roles.join("_")}`
  }

  public getProblemSolvers(): ProblemSolver[] {
    return [
      CreepInsufficiencyProblemSolver.create(this.identifier, this.roomName, this.roles, this.body, this.targetTaskRunnerIdentifier)
    ]
  }
}
