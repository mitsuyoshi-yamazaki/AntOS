import { ProblemSolver } from "objective/problem_solver"
import { CreepRole } from "prototype/creep"
import { RoomName } from "prototype/room"
import { spawnPoolSpawnRequestPriorityLow } from "world_info/resource_pool/spawn_resource_pool"
import { World } from "world_info/world_info"

export class CreepInsufficiencyProblemSolver implements ProblemSolver {
  public constructor(
    public readonly roomName: RoomName,
    public readonly role: CreepRole,
  ) {
  }

  public run(): void {
    World.resourcePools.addSpawnCreepRequest(
      this.roomName,
      {
        priority: spawnPoolSpawnRequestPriorityLow,
        numberOfCreeps: 1,  // TODO:
        body: this.body(),
        roles: [this.role],
        codename: "creep",  // TODO:
      }
    )
  }

  private body(): BodyPartConstant[] { // FixMe: 必要なサイズに
    return [WORK, CARRY, MOVE, MOVE]
  }
}
