import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { GameConstants } from "utility/constants"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type HarvestEnergyState = {
  readonly t: TaskTypeEncodingMap["HarvestEnergy"]
  readonly tg: Id<Source>
}

export class HarvestEnergy extends Task<HarvestEnergyState> {
  public readonly actionType = "harvest"

  private constructor(
    public readonly targetId: Id<Source>,
  ) {
    super()
  }

  public static decode(state: HarvestEnergyState): HarvestEnergy {
    return new HarvestEnergy(state.tg)
  }

  public static create(targetId: Id<Source>): HarvestEnergy {
    return new HarvestEnergy(targetId)
  }

  public encode(): HarvestEnergyState {
    return {
      t: "b",
      tg: this.targetId,
    }
  }

  public run(creep: AnyV5Creep): TaskResult {
    const target = Game.getObjectById(this.targetId)
    if (target == null) {
      return "failed"
    }
    if (creep.harvest(target) === OK) {
      creep.executedActions.add(this.actionType)

      const harvestPower = creep.body.filter(body => body.type === WORK).length * GameConstants.creep.actionPower.harvestEnergy
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= harvestPower) {
        return "finished"
      }
      return "in progress"
    }
    return "failed"
  }
}
