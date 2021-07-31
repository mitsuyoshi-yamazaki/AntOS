import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type DismantleApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface DismantleApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<AnyStructure>
}

export class DismantleApiWrapper implements ApiWrapper<Creep, DismantleApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "dismantle"
  public readonly range = 1

  private constructor(
    public readonly target: AnyStructure,
  ) { }

  public encode(): DismantleApiWrapperState {
    return {
      t: "DismantleApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: DismantleApiWrapperState): DismantleApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new DismantleApiWrapper(target)
  }

  public static create(target: AnyStructure): DismantleApiWrapper {
    return new DismantleApiWrapper(target)
  }

  public run(creep: Creep): DismantleApiWrapperResult {
    const result = creep.dismantle(this.target)

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
      PrimitiveLogger.fatal(`creep.dismantle() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
