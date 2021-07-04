import { ProblemSolver } from "objective/problem_solver"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { creepSpawnRequestPriorityLow } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

export class CreepInsufficiencyProblemSolver implements ProblemSolver {
  public constructor(
    public readonly roomName: RoomName,
    public readonly roles: CreepRole[],
  ) {
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

  private body(): BodyPartConstant[] { // FixMe: 必要なサイズに
    return [WORK, CARRY, MOVE, MOVE]
  }
}
