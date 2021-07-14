import { Sign } from "game/sign"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "object_task/api_wrapper"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type ReserveControllerApiWrapperResult = FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface ReserveControllerApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<StructureController>
}

export class ReserveControllerApiWrapper implements ApiWrapper<Creep, ReserveControllerApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "reserve"
  private constructor(
    public readonly target: StructureController,
  ) { }

  public encode(): ReserveControllerApiWrapperState {
    return {
      t: "ReserveControllerApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: ReserveControllerApiWrapperState): ReserveControllerApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new ReserveControllerApiWrapper(source)
  }

  public static create(target: StructureController): ReserveControllerApiWrapper {
    return new ReserveControllerApiWrapper(target)
  }

  public run(creep: Creep): ReserveControllerApiWrapperResult {
    const result = (() => {
      if (this.target.owner != null) {
        return creep.attackController(this.target)
      }
      if (this.target.reservation != null && this.target.reservation.username !== Game.user.name) {
        return creep.attackController(this.target)
      }
      return creep.reserveController(this.target)
    })()
    creep.signController(this.target, Sign.sign(creep.room))

    switch (result) {
    case OK: {
      return FINISHED_AND_RAN
    }

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NO_BODYPART:
      return ERR_DAMAGED

    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`creep.reserveController() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
