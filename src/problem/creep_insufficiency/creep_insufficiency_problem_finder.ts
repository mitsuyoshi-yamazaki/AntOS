import { ProblemFinder, ProblemIdentifier } from "problem/problem_finder"
import { ProblemSolver } from "problem/problem_solver"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "utility/room_name"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { TaskIdentifier } from "task/task"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"

export class CreepInsufficiencyProblemFinder implements ProblemFinder {
  public readonly identifier: ProblemIdentifier
  public readonly creepCount: number

  private readonly insufficientCreepCount: number

  public constructor(
    public readonly roomName: RoomName,
    public readonly necessaryRoles: CreepRole[] | null,
    public readonly creepRoles: CreepRole[],
    public readonly targetTaskIdentifier: TaskIdentifier | null,
    public readonly minimumCreepCount: number,
  ) {
    const components: string[] = [
      this.constructor.name,
    ]
    if (this.necessaryRoles != null) {
      components.push(this.necessaryRoles.join(","))
    } else {
      components.push("null")
    }
    if (this.targetTaskIdentifier != null) {
      components.push(this.targetTaskIdentifier)
    }
    this.identifier = components.join("_")

    const creepPoolFilter = ((): CreepPoolFilter => {
      if (this.necessaryRoles != null) {
        const roles = this.necessaryRoles
        return (creep => hasNecessaryRoles(creep, roles))
      }
      return () => true
    })()
    this.creepCount = World.resourcePools.countCreeps(this.roomName, this.targetTaskIdentifier, creepPoolFilter)
    this.insufficientCreepCount = this.minimumCreepCount - this.creepCount
  }

  public problemExists(): boolean {
    return this.insufficientCreepCount > 0
  }

  public getProblemSolvers(): ProblemSolver[] {
    if (this.problemExists() !== true) {
      return []
    }
    return [
      CreepInsufficiencyProblemSolver.create(this.identifier, this.roomName, this.creepRoles, this.targetTaskIdentifier, this.minimumCreepCount)
    ]
  }
}
