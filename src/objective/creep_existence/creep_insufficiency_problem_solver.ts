import { ProblemIdentifier } from "objective/problem"
import { ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { TaskRunnerIdentifier } from "objective/task_runner"
import { RoomName } from "prototype/room"
import { CreepSpawnRequest, CreepSpawnRequestState, decodeCreepSpawnRequest, encodeCreepSpawnRequest } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

export interface CreepInsufficiencyProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName,

  /** creep spawn request state */
  cr: CreepSpawnRequestState
}

export class CreepInsufficiencyProblemSolver implements ProblemSolver {
  public get taskRunnerIdentifier(): TaskRunnerIdentifier {
    return this.problemIdentifier
  }

  private constructor(
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    private readonly request: CreepSpawnRequest,
  ) {
  }

  public encode(): CreepInsufficiencyProblemSolverState {
    return {
      t: "CreepInsufficiencyProblemSolver",
      p: this.problemIdentifier,
      r: this.roomName,
      cr: encodeCreepSpawnRequest(this.request),
    }
  }

  public static decode(state: CreepInsufficiencyProblemSolverState): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(state.p, state.r, decodeCreepSpawnRequest(state.cr))
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName, request: CreepSpawnRequest): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(problemIdentifier, roomName, request)
  }

  public run(): void {
    World.resourcePools.addSpawnCreepRequest(this.roomName, this.request)
  }
}
