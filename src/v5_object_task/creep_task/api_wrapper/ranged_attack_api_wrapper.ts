import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type RangedAttackApiWrapperTarget = AnyStructure | AnyCreep
type RangedAttackApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface RangedAttackApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<RangedAttackApiWrapperTarget>
}

export class RangedAttackApiWrapper implements ApiWrapper<Creep, RangedAttackApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "r-attack"
  public readonly range = 1

  private constructor(
    public readonly target: RangedAttackApiWrapperTarget,
  ) { }

  public encode(): RangedAttackApiWrapperState {
    return {
      t: "RangedAttackApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: RangedAttackApiWrapperState): RangedAttackApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new RangedAttackApiWrapper(target)
  }

  public static create(target: RangedAttackApiWrapperTarget): RangedAttackApiWrapper {
    return new RangedAttackApiWrapper(target)
  }

  public run(creep: Creep): RangedAttackApiWrapperResult {
    const result = (() => {
      if (creep.pos.isNearTo(this.target.pos) === true) {
        return creep.rangedMassAttack()
      } else {
        return creep.rangedAttack(this.target)
      }
    })()

    if (result !== OK) {
      creep.heal(creep)
    }

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
      PrimitiveLogger.fatal(`creep.rangedAttack() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
