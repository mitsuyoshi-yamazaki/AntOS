import { Problem, ProblemIdentifier } from "objective/problem"
import { ProblemSolver } from "objective/problem_solver"
import { TaskRunnerIdentifier } from "objective/task_runner"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { CreepTask } from "task/creep_task/creep_task"
import { CreepInsufficiencyProblemSolver } from "./creep_insufficiency_problem_solver"

export class CreepInsufficiencyProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
    public readonly body: BodyPartConstant[] | null,
    public readonly initialTask: CreepTask | null,
    public readonly targetTaskRunnerIdentifier: TaskRunnerIdentifier | null,
    public readonly remoteRoomName: RoomName | null,
  ) {
    this.identifier = `${this.constructor.name}_${roomName}_${roles.join("_")}`
  }

  public getProblemSolvers(): ProblemSolver[] {
    return [
      CreepInsufficiencyProblemSolver.create(this.identifier, this.roomName, this.roles, this.body, this.initialTask, this.targetTaskRunnerIdentifier, this.remoteRoomName)
    ]
  }
}
