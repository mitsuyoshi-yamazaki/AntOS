import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type HealApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface HealApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<AnyCreep>
}

export class HealApiWrapper implements ApiWrapper<Creep, HealApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "build"
  public readonly range = 1

  private constructor(
    public readonly target: AnyCreep,
  ) { }

  public encode(): HealApiWrapperState {
    return {
      t: "HealApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: HealApiWrapperState): HealApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new HealApiWrapper(target)
  }

  public static create(target: AnyCreep): HealApiWrapper {
    return new HealApiWrapper(target)
  }

  public run(creep: Creep): HealApiWrapperResult {
    const result = creep.heal(this.target)

    switch (result) {
    case OK:
      return FINISHED_AND_RAN

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NO_BODYPART:
      return ERR_DAMAGED

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`creep.heal() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
