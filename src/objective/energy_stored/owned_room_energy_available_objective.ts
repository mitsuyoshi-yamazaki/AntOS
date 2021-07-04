import { CreepInsufficiencyProblem } from "objective/creep_existence/creep_insufficiency_problem"
import { Objective, ObjectiveStatus, ObjectiveStatusAchieved, ObjectiveStatusNotAchieved } from "objective/objective"
import { Problem } from "objective/problem"
import { creepRoleEnergyStore } from "prototype/creep"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { EnergyInsufficiencyProblem } from "./energy_insufficiency_problem"

export class OwnedRoomEnergyAvailableObjective implements Objective {
  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) { }

  public currentStatus(): ObjectiveStatus {
    const problems: Problem[] = []
    const numberOfEnergyStoreCreeps = World.resourcePools.checkCreeps(
      this.objects.controller.room.name,
      creep => {
        if (creep.memory.v5 == null) {
          return false
        }
        return creep.memory.v5.r.includes(creepRoleEnergyStore)
      },
    )
    if (this.objects.energyStores.length <= 0 && numberOfEnergyStoreCreeps <= 0) {
      problems.push(new EnergyInsufficiencyProblem(this.objects.controller.room.name))
    }
    if (numberOfEnergyStoreCreeps <= 0) {
      problems.push(new CreepInsufficiencyProblem(this.objects.controller.room.name, creepRoleEnergyStore))
    }

    if (problems.length > 0) {
      return new ObjectiveStatusNotAchieved(problems)
    }
    return new ObjectiveStatusAchieved()
  }
}
