import { ProblemIdentifier } from "objective/problem"
import { ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { creepSpawnRequestPriorityLow } from "world_info/resource_pool/creep_specs"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export interface CreepInsufficiencyProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName,

  /** creep roles */
  cr: CreepRole[]

  /** creep body */
  cb: BodyPartConstant[] | null
}

export class CreepInsufficiencyProblemSolver implements ProblemSolver {
  private constructor(
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
    public readonly body: BodyPartConstant[] | null,
  ) {
  }

  public encode(): CreepInsufficiencyProblemSolverState {
    return {
      t: "CreepInsufficiencyProblemSolver",
      p: this.problemIdentifier,
      r: this.roomName,
      cr: this.roles,
      cb: this.body,
    }
  }

  public static decode(state: CreepInsufficiencyProblemSolverState): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(state.p, state.r, state.cr, state.cb)
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName, roles: CreepRole[], body: BodyPartConstant[] | null): CreepInsufficiencyProblemSolver {
    return new CreepInsufficiencyProblemSolver(problemIdentifier, roomName, roles, body)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public run(objects: OwnedRoomObjects): void {
    World.resourcePools.addSpawnCreepRequest(
      this.roomName,
      {
        priority: creepSpawnRequestPriorityLow,
        numberOfCreeps: 1,  // TODO:
        roles: this.roles,
        body: this.body,
        codename: "creep",  // TODO:
      }
    )
  }
}
