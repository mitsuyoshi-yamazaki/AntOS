import { Sign } from "game/sign"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type ClaimControllerApiWrapperResult = FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface ClaimControllerApiWrapperState extends CreepApiWrapperState {
  /** target id */
  readonly i: Id<StructureController>
  readonly sign: string | null
}

export class ClaimControllerApiWrapper implements ApiWrapper<Creep, ClaimControllerApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "claim"
  public readonly range = 1
  private constructor(
    public readonly target: StructureController,
    private readonly sign: string | null
  ) { }

  public encode(): ClaimControllerApiWrapperState {
    return {
      t: "ClaimControllerApiWrapper",
      i: this.target.id,
      sign: this.sign,
    }
  }

  public static decode(state: ClaimControllerApiWrapperState): ClaimControllerApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new ClaimControllerApiWrapper(source, state.sign ?? null)
  }

  public static create(target: StructureController, sign?: string): ClaimControllerApiWrapper {
    return new ClaimControllerApiWrapper(target, sign ?? null)
  }

  public run(creep: Creep): ClaimControllerApiWrapperResult {
    const shouldAttack = ((): boolean => {
      if (this.target.owner != null) {
        if (this.target.owner.username !== Game.user.name) {
          return true
        }
        return false
      }
      if (this.target.reservation != null) {
        if (this.target.reservation.username !== Game.user.name) {
          return true
        }
        return false
      }
      return false
    })()
    const result = shouldAttack ? creep.attackController(this.target) : creep.claimController(this.target)

    if (shouldAttack === true) {
      // TODO: sign
    } else {
      const roomSign = this.sign ?? Sign.signForOwnedRoom()
      creep.signController(this.target, roomSign)
    }

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

    case ERR_GCL_NOT_ENOUGH:
      creep.reserveController(this.target)
      return IN_PROGRESS

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_FULL:
    default:
      PrimitiveLogger.fatal(`creep.claimController() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
