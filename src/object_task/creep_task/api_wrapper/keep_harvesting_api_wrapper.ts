import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "object_task/api_wrapper"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type KeepHarvestingApiWrapperResult = IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_NOT_ENOUGH_RESOURCES | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface KeepHarvestingApiWrapperState extends CreepApiWrapperState {
  /** source id */
  i: Id<Source>

  /** resource type */
  r: ResourceConstant
}

export class KeepHarvestingApiWrapper implements ApiWrapper<Creep, KeepHarvestingApiWrapperResult>, TargetingApiWrapper {
  public get target(): Source {
    return this.source
  }
  public readonly shortDescription: string

  private constructor(
    public readonly source: Source,
    public readonly resourceType: ResourceConstant,
  ) {
    this.shortDescription = this.resourceType
  }

  public encode(): KeepHarvestingApiWrapperState {
    return {
      t: "KeepHarvestingApiWrapper",
      i: this.source.id,
      r: this.resourceType,
    }
  }

  public static decode(state: KeepHarvestingApiWrapperState): KeepHarvestingApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new KeepHarvestingApiWrapper(source, state.r)
  }

  public static create(source: Source, resourceType: ResourceConstant): KeepHarvestingApiWrapper {
    return new KeepHarvestingApiWrapper(source, resourceType)
  }

  public run(creep: Creep): KeepHarvestingApiWrapperResult {
    const result = creep.harvest(this.source)

    switch (result) {
    case OK:
      return IN_PROGRESS

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_NOT_ENOUGH_RESOURCES:
      return ERR_NOT_ENOUGH_RESOURCES

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NO_BODYPART:
      return ERR_DAMAGED

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_NOT_FOUND:
    case ERR_TIRED:
    default:
      PrimitiveLogger.fatal(`KeepHarvestingApiWrapper creep.harvest() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
