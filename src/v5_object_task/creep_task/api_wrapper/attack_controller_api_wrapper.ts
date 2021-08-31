import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { Sign } from "game/sign"

type AttackControllerApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface AttackControllerApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<StructureController>
}

export class AttackControllerApiWrapper implements ApiWrapper<Creep, AttackControllerApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "downgrade"
  public readonly range = 1

  private constructor(
    public readonly target: StructureController,
  ) { }

  public encode(): AttackControllerApiWrapperState {
    return {
      t: "AttackControllerApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: AttackControllerApiWrapperState): AttackControllerApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new AttackControllerApiWrapper(target)
  }

  public static create(target: StructureController): AttackControllerApiWrapper {
    return new AttackControllerApiWrapper(target)
  }

  public run(creep: Creep): AttackControllerApiWrapperResult {
    if (this.target.owner == null || this.target.my === true) {
      return FINISHED
    }

    const result = creep.attackController(this.target)
    if (this.target.sign == null || this.target.sign.username !== Game.user.name) {
      creep.signController(this.target, Sign.signForHostileRoom())
    }

    switch (result) {
    case OK: {
      return FINISHED_AND_RAN
    }

    case ERR_TIRED:
      return FINISHED

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NO_BODYPART:
      return ERR_DAMAGED

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`creep.attackController() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
