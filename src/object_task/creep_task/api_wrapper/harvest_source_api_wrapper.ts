import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "HarvestSourceApiWrapper"

export interface HarvestSourceApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "HarvestSourceApiWrapper"

  /** source id */
  i: Id<Source>
}

export class HarvestSourceApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription = "h-source"
  public readonly range = 1

  private constructor(
    public readonly target: Source,
  ) {
  }

  public encode(): HarvestSourceApiWrapperState {
    return {
      t: apiWrapperType,
      i: this.target.id,
    }
  }

  public static decode(state: HarvestSourceApiWrapperState): HarvestSourceApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new HarvestSourceApiWrapper(target)
  }

  public static create(target: Source): HarvestSourceApiWrapper {
    return new HarvestSourceApiWrapper(target)
  }

  public run(creep: Creep): CreepApiWrapperProgress {
    const result = creep.harvest(this.target)

    switch (result) {
    case OK: {
      const harvestAmount = creep.body.filter(b => b.type === WORK).length * HARVEST_POWER
      if (creep.store.getFreeCapacity() <= harvestAmount) {
        return CreepApiWrapperProgress.Finished(true)
      } else {
        return CreepApiWrapperProgress.InProgress(false)
      }
    }

    case ERR_NOT_IN_RANGE:
      return CreepApiWrapperProgress.InProgress(true)

    case ERR_NOT_ENOUGH_RESOURCES:
      return CreepApiWrapperProgress.InProgress(creep.pos.isNearTo(this.target.pos) !== true)

    case ERR_BUSY:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NO_BODYPART:
    case ERR_NOT_OWNER: // roomをclaim/reserveしていない場合
    case ERR_INVALID_TARGET:
    case ERR_NOT_FOUND:
    case ERR_TIRED:
    default:
      return CreepApiWrapperProgress.Failed(apiWrapperType, creep.name, result)
    }
  }
}
