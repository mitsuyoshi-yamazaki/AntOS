import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { GameConstants } from "utility/constants"

type RangedHealApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface RangedHealApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<AnyCreep>
}

export class RangedHealApiWrapper implements ApiWrapper<Creep, RangedHealApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "build"
  public readonly range = GameConstants.creep.actionRange.rangedHeal

  private constructor(
    public readonly target: AnyCreep,
  ) { }

  public encode(): RangedHealApiWrapperState {
    return {
      t: "RangedHealApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: RangedHealApiWrapperState): RangedHealApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new RangedHealApiWrapper(target)
  }

  public static create(target: AnyCreep): RangedHealApiWrapper {
    return new RangedHealApiWrapper(target)
  }

  public run(creep: Creep): RangedHealApiWrapperResult {
    const result = creep.rangedHeal(this.target)

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
      PrimitiveLogger.fatal(`creep.rangedHeal() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
