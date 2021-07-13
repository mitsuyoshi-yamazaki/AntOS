import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "object_task/api_wrapper"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type HarvestEnergyApiWrapperResult = FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_NOT_ENOUGH_RESOURCES | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface HarvestEnergyApiWrapperState extends CreepApiWrapperState {
  /** source id */
  i: Id<Source>
}

export class HarvestEnergyApiWrapper implements ApiWrapper<Creep, HarvestEnergyApiWrapperResult>, TargetingApiWrapper {
  public get target(): Source {
    return this.source
  }
  public readonly shortDescription = "E-harvest"

  private constructor(
    public readonly source: Source,
  ) { }

  public encode(): HarvestEnergyApiWrapperState {
    return {
      t: "HarvestEnergyApiWrapper",
      i: this.source.id,
    }
  }

  public static decode(state: HarvestEnergyApiWrapperState): HarvestEnergyApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new HarvestEnergyApiWrapper(source)
  }

  public static create(source: Source): HarvestEnergyApiWrapper {
    return new HarvestEnergyApiWrapper(source)
  }

  public run(creep: Creep): HarvestEnergyApiWrapperResult {
    const result = creep.harvest(this.source)

    switch (result) {
    case OK: {
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
      PrimitiveLogger.fatal(`creep.harvest() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
