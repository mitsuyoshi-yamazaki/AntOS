import { ProblemIdentifier } from "objective/problem"
import { ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { TaskRunnerIdentifier } from "objective/task_runner"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { creepSpawnRequestPriorityLow } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

export interface CreepInsufficiencyProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName,

  /** creep roles */
  cr: CreepRole[]

  /** creep body */
  cb: BodyPartConstant[] | null

  /** creep task runner identifier */
  ct: TaskRunnerIdentifier | null
}

export class CreepInsufficiencyProblemSolver implements ProblemSolver {
  public get taskRunnerIdentifier(): TaskRunnerIdentifier {
    return this.problemIdentifier
  }

  private constructor(
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
    public readonly body: BodyPartConstant[] | null,
    public readonly registeredTaskRunnerIdentifier: TaskRunnerIdentifier | null
  ) {
  }

  public encode(): CreepInsufficiencyProblemSolverState {
    return {
      t: "CreepInsufficiencyProblemSolver",
      p: this.problemIdentifier,
      r: this.roomName,
      cr: this.roles,
      cb: this.body,
      ct: this.registeredTaskRunnerIdentifier,
    }
  }

  public static decode(state: CreepInsufficiencyProblemSolverState): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(state.p, state.r, state.cr, state.cb, state.ct)
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName, roles: CreepRole[], body: BodyPartConstant[] | null, taskRunnerIdentifier: TaskRunnerIdentifier | null): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(problemIdentifier, roomName, roles, body, taskRunnerIdentifier)
  }

  public run(): void {
    World.resourcePools.addSpawnCreepRequest(
      this.roomName,
      {
        priority: creepSpawnRequestPriorityLow,
        numberOfCreeps: 1,  // TODO:
        roles: this.roles,
        body: this.body,
        codename: "creep",  // TODO:
        initialTask: null,
        taskRunnerIdentifier: this.registeredTaskRunnerIdentifier,
      }
    )
  }
}
