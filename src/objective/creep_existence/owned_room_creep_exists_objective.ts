import { Objective, ObjectiveStatus, ObjectiveStatusAchieved, ObjectiveStatusNotAchieved } from "objective/objective"
import { CreepRole } from "prototype/creep"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblem } from "./creep_insufficiency_problem"

export class OwnedRoomCreepExistsObjective implements Objective {
  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly creepRole: CreepRole,
    public readonly requiredCreeps: number,
  ) { }

  public currentStatus(): ObjectiveStatus {
    const numberOfCreeps = World.resourcePools.checkCreeps(
      this.objects.controller.room.name,
      creep => {
        if (creep.memory.v5 == null) {
          return false
        }
        return creep.memory.v5.r.includes(this.creepRole)
      },
    )
    if (numberOfCreeps > this.requiredCreeps) {
      return new ObjectiveStatusAchieved()
    }
    return new ObjectiveStatusNotAchieved([new CreepInsufficiencyProblem(this.objects.controller.room.name, this.creepRole)])
  }
}
