import { Objective } from "objective/objective"
import { Problem } from "objective/problem"
import { TaskRunner } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblem } from "./creep_insufficiency_problem"

export class OwnedRoomCreepExistsObjective implements Objective {
  public readonly children: Objective[]

  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly creepRoles: CreepRole[],
    public readonly requiredCreeps: number,
  ) {
    this.children = []
  }

  public taskRunners(): TaskRunner[] {
    return this.children.flatMap(child => child.taskRunners())
  }

  public currentProblems(): Problem[] {
    const problems: Problem[] = this.children.flatMap(child => child.currentProblems())
    const numberOfCreeps = World.resourcePools.checkCreeps(
      this.objects.controller.room.name,
      creep => hasNecessaryRoles(creep, this.creepRoles),
    )
    if (numberOfCreeps <= this.requiredCreeps) {
      problems.push(new CreepInsufficiencyProblem(this.objects.controller.room.name, this.creepRoles))
    }
    return problems
  }
}
