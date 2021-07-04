import { ProblemIdentifier } from "objective/problem"
import { ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { creepSpawnRequestPriorityLow } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

export interface CreepInsufficiencyProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName,

  /** creep roles */
  cr: CreepRole[]
}

export class CreepInsufficiencyProblemSolver implements ProblemSolver {
  private constructor(
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
  ) {
  }

  public encode(): CreepInsufficiencyProblemSolverState {
    return {
      t: "CreepInsufficiencyProblemSolver",
      p: this.problemIdentifier,
      r: this.roomName,
      cr: this.roles,
    }
  }

  public static decode(state: CreepInsufficiencyProblemSolverState): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(state.p, state.r, state.cr)
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName, roles: CreepRole[]): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(problemIdentifier, roomName, roles)
  }

  public run(): void {
    World.resourcePools.addSpawnCreepRequest(
      this.roomName,
      {
        priority: creepSpawnRequestPriorityLow,
        numberOfCreeps: 1,  // TODO:
        roles: this.roles,
        codename: "creep",  // TODO:
      }
    )
  }
}
