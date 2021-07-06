import { ProblemFinder, ProblemIdentifier } from "problem/problem_finder"
import { ProblemSolver } from "problem/problem_solver"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { TaskIdentifier } from "task/task"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"

export class CreepInsufficiencyProblemFinder implements ProblemFinder {
  public readonly identifier: ProblemIdentifier

  private readonly insufficientCreepCount: number

  public constructor(
    public readonly roomName: RoomName,
    public readonly necessaryRoles: CreepRole[],
    public readonly targetTaskIdentifier: TaskIdentifier | null,
    public readonly minimumCreepCount: number,
  ) {
    const components: string[] = [
      this.constructor.name,
      this.necessaryRoles.join(","),
    ]
    if (this.targetTaskIdentifier != null) {
      components.push(this.targetTaskIdentifier)
    }
    this.identifier = components.join("_")

    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, this.necessaryRoles)
    const creepCount = World.resourcePools.countCreeps(this.roomName, this.targetTaskIdentifier, creepPoolFilter)
    this.insufficientCreepCount = this.minimumCreepCount - creepCount
  }

  public problemExists(): boolean {
    return this.insufficientCreepCount > 0
  }

  public getProblemSolvers(): ProblemSolver[] {
    return [
      CreepInsufficiencyProblemSolver.create(this.identifier, this.roomName, this.necessaryRoles, this.targetTaskIdentifier, this.minimumCreepCount)
    ]
  }
}
