import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type HarvestEnergyApiWrapperResult = FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_NOT_ENOUGH_RESOURCES | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface HarvestEnergyApiWrapperState extends CreepApiWrapperState {
  /** source id */
  i: Id<Source>

  shouldKeepHarvesting: boolean
}

export class HarvestEnergyApiWrapper implements ApiWrapper<Creep, HarvestEnergyApiWrapperResult>, TargetingApiWrapper {
  public get target(): Source {
    return this.source
  }
  public readonly shortDescription = "E-harvest"

  private constructor(
    public readonly source: Source,
    private readonly shouldKeepHarvesting: boolean,
  ) { }

  public encode(): HarvestEnergyApiWrapperState {
    return {
      t: "HarvestEnergyApiWrapper",
      i: this.source.id,
      shouldKeepHarvesting: this.shouldKeepHarvesting,
    }
  }

  public static decode(state: HarvestEnergyApiWrapperState): HarvestEnergyApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new HarvestEnergyApiWrapper(source, state.shouldKeepHarvesting ?? false)
  }

  public static create(source: Source, shouldKeepHarvesting?: boolean): HarvestEnergyApiWrapper {
    return new HarvestEnergyApiWrapper(source, shouldKeepHarvesting ?? false)
  }

  public run(creep: Creep): HarvestEnergyApiWrapperResult {
    const result = creep.harvest(this.source)

    switch (result) {
    case OK: {
      if (this.shouldKeepHarvesting === true) {
        return IN_PROGRESS
      }
      const harvestAmount = creep.body.filter(b => b.type === WORK).length * HARVEST_POWER
      if (creep.store.getFreeCapacity() <= harvestAmount) {
        return FINISHED_AND_RAN
      } else {
        return IN_PROGRESS
      }
    }

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_NOT_ENOUGH_RESOURCES:
      return ERR_NOT_ENOUGH_RESOURCES

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NO_BODYPART:
      return ERR_DAMAGED

    case ERR_NOT_OWNER: // TODO: InvaderCoreがいると出る
    case ERR_INVALID_TARGET:
    case ERR_NOT_FOUND:
    case ERR_TIRED:
    default:
      if ((Game.time % 19) === 7) {
        PrimitiveLogger.fatal(`creep.harvest() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      }
      return ERR_PROGRAMMING_ERROR
    }
  }
}
