import { Objective, ObjectiveStatus } from "objective/objective"
import { TaskRunner } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblem } from "./creep_insufficiency_problem"

export class OwnedRoomCreepExistsObjective implements Objective {
  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly creepRoles: CreepRole[],
    public readonly requiredCreeps: number,
  ) { }

  public taskRunners(): TaskRunner[] {
    return []
  }

  public currentStatus(): ObjectiveStatus {
    const numberOfCreeps = World.resourcePools.checkCreeps(
      this.objects.controller.room.name,
      creep => hasNecessaryRoles(creep, this.creepRoles),
    )
    if (numberOfCreeps > this.requiredCreeps) {
      return ObjectiveStatus.Achieved()
    }
    return ObjectiveStatus.NotAchieved([new CreepInsufficiencyProblem(this.objects.controller.room.name, this.creepRoles)])
  }
}
