import { Sign } from "game/sign"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "task/api_wrapper"
import { TargetingApiWrapper } from "task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type ClaimControllerApiWrapperResult = FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface ClaimControllerApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<StructureController>
}

export class ClaimControllerApiWrapper implements ApiWrapper<Creep, ClaimControllerApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "claim"
  private constructor(
    public readonly target: StructureController,
  ) { }

  public encode(): ClaimControllerApiWrapperState {
    return {
      t: "ClaimControllerApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: ClaimControllerApiWrapperState): ClaimControllerApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new ClaimControllerApiWrapper(source)
  }

  public static create(target: StructureController): ClaimControllerApiWrapper {
    return new ClaimControllerApiWrapper(target)
  }

  public run(creep: Creep): ClaimControllerApiWrapperResult {
    const result = creep.claimController(this.target)
    creep.signController(this.target, Sign.signForOwnedRoom())

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
      PrimitiveLogger.fatal(`creep.claimController() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
