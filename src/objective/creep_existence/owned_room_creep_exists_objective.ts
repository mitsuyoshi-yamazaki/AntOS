import { Objective, ObjectiveStatus, ObjectiveStatusAchieved, ObjectiveStatusNotAchieved } from "objective/objective"
import { CreepRole, hasNecessaryRoles } from "prototype/creep"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblem } from "./creep_insufficiency_problem"

export class OwnedRoomCreepExistsObjective implements Objective {
  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly creepRoles: CreepRole[],
    public readonly requiredCreeps: number,
  ) { }

  public currentStatus(): ObjectiveStatus {
    const numberOfCreeps = World.resourcePools.checkCreeps(
      this.objects.controller.room.name,
      creep => hasNecessaryRoles(creep, this.creepRoles),
    )
    if (numberOfCreeps > this.requiredCreeps) {
      return new ObjectiveStatusAchieved()
    }
    return new ObjectiveStatusNotAchieved([new CreepInsufficiencyProblem(this.objects.controller.room.name, this.creepRoles)])
  }
}
