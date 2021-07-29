import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type AttackApiWrapperTarget = AnyStructure | AnyCreep
type AttackApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface AttackApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<AttackApiWrapperTarget>
}

export class AttackApiWrapper implements ApiWrapper<Creep, AttackApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "attack"
  public readonly range = 1

  private constructor(
    public readonly target: AttackApiWrapperTarget,
  ) { }

  public encode(): AttackApiWrapperState {
    return {
      t: "AttackApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: AttackApiWrapperState): AttackApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new AttackApiWrapper(target)
  }

  public static create(target: AttackApiWrapperTarget): AttackApiWrapper {
    return new AttackApiWrapper(target)
  }

  public run(creep: Creep): AttackApiWrapperResult {
    const result = creep.attack(this.target)

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
      PrimitiveLogger.fatal(`creep.attack() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
