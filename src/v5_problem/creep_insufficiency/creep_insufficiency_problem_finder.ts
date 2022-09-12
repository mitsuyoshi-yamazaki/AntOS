import { ProblemFinder, ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver } from "v5_problem/problem_solver"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import type { RoomName } from "shared/utility/room_name_types"
import { CreepInsufficiencyProblemSolver } from "v5_task/creep_spawn/creep_insufficiency_problem_solver"
import { TaskIdentifier } from "v5_task/task"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText } from "utility/log"
import { CpuPointMeasurer } from "shared/utility/cpu_measurer"

// const cpuUsageHandler = (identifier: string, cpuUsage: number): void => {
//   PrimitiveLogger.log(`${coloredText("[CPU]", "critical")} ${identifier}: ${cpuUsage}`)
// }
// const pointMeasurer = new CpuPointMeasurer(cpuUsageHandler, 0.5, "default")

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

    // pointMeasurer.reset(this.identifier)

    const creepPoolFilter = ((): CreepPoolFilter | undefined => {
      if (this.necessaryRoles == null) {
        return undefined
      }
      const roles = this.necessaryRoles
      return (creep => hasNecessaryRoles(creep, roles))
    })()
    this.creepCount = World.resourcePools.countCreeps(this.roomName, this.targetTaskIdentifier, creepPoolFilter)
    this.insufficientCreepCount = this.minimumCreepCount - this.creepCount
    // pointMeasurer.measure(`roles: ${this.necessaryRoles}`)
  }

  public problemExists(): boolean {
    return this.insufficientCreepCount > 0
  }

  public getProblemSolvers(): ProblemSolver[] {
    if (this.problemExists() !== true) {
      return []
    }
    return [
      CreepInsufficiencyProblemSolver.create(this.identifier, this.roomName, this.necessaryRoles, this.targetTaskIdentifier, this.minimumCreepCount)
    ]
  }
}
