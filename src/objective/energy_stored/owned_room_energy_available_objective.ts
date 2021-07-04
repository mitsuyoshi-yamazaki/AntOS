import { CreepInsufficiencyProblem } from "objective/creep_existence/creep_insufficiency_problem"
import { Objective, ObjectiveStatus, ObjectiveStatusAchieved, ObjectiveStatusNotAchieved } from "objective/objective"
import { Problem } from "objective/problem"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { EnergyInsufficiencyProblem } from "./energy_insufficiency_problem"

export class OwnedRoomEnergyAvailableObjective implements Objective {
  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) { }

  public currentStatus(): ObjectiveStatus {
    const necessaryRoles: CreepRole[] = [CreepRole.EnergyStore, CreepRole.Mover]
    const problems: Problem[] = []
    const numberOfEnergyStoreCreeps = World.resourcePools.checkCreeps(
      this.objects.controller.room.name,
      creep => hasNecessaryRoles(creep, necessaryRoles),
    )
    if (this.objects.energyStores.length <= 0 && numberOfEnergyStoreCreeps <= 0) {
      problems.push(new EnergyInsufficiencyProblem(this.objects.controller.room.name))
    }
    if (numberOfEnergyStoreCreeps <= 0) {
      problems.push(new CreepInsufficiencyProblem(this.objects.controller.room.name, necessaryRoles))
    }

    if (problems.length > 0) {
      return new ObjectiveStatusNotAchieved(problems)
    }
    return new ObjectiveStatusAchieved()
  }
}
