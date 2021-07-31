import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type TempRenewApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR

export interface TempRenewApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<StructureSpawn>
}

export class TempRenewApiWrapper implements ApiWrapper<Creep, TempRenewApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "renew"
  public readonly range = 1

  private constructor(
    public readonly target: StructureSpawn,
  ) { }

  public encode(): TempRenewApiWrapperState {
    return {
      t: "TempRenewApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: TempRenewApiWrapperState): TempRenewApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new TempRenewApiWrapper(target)
  }

  public static create(target: StructureSpawn): TempRenewApiWrapper {
    return new TempRenewApiWrapper(target)
  }

  public run(creep: Creep): TempRenewApiWrapperResult {
    if (creep.ticksToLive != null && creep.ticksToLive > 1400) {
      return FINISHED
    }

    const result = this.target.renewCreep(creep)

    switch (result) {
    case OK:
      return IN_PROGRESS

    case ERR_FULL:
      return FINISHED

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_NOT_ENOUGH_RESOURCES:
      return FINISHED

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`creep.build() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
