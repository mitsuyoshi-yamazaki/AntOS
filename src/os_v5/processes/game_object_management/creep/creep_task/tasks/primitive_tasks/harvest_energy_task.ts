import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { GameConstants } from "utility/constants"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type HarvestEnergyState = {
  readonly t: TaskTypeEncodingMap["HarvestEnergy"]
  readonly tg: Id<Source>
}

export type HarvestEnergyResult = void
export type HarvestEnergyError = Exclude<ReturnType<Creep["harvest"]>, OK> | "no_source"


export class HarvestEnergy extends Task<HarvestEnergyState, HarvestEnergyResult, HarvestEnergyError> {
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

  public run(creep: AnyV5Creep): TaskResult<HarvestEnergyResult, HarvestEnergyError> {
    const target = Game.getObjectById(this.targetId)
    if (target == null) {
      return {
        case: "failed",
        taskType: "HarvestEnergy",
        error: "no_source",
      }
    }

    const result = creep.harvest(target)
    if (result === OK) {
      creep.executedActions.add(this.actionType)

      const harvestPower = creep.body.filter(body => body.type === WORK).length * GameConstants.creep.actionPower.harvestEnergy
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= harvestPower) {
        return {
          case: "finished",
          taskType: "HarvestEnergy",
          result: undefined,
        }
      }
      return {
        case: "in_progress",
      }
    }
    return {
      case: "failed",
      taskType: "HarvestEnergy",
      error: result,
    }
  }
}
