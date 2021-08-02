import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type PickupApiWrapperResult = FINISHED | FINISHED_AND_RAN | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR

export interface PickupApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<Resource>
}

export class PickupApiWrapper implements ApiWrapper<Creep, PickupApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "pickup"
  public readonly range = 0

  private constructor(
    public readonly target: Resource,
  ) {
  }

  public encode(): PickupApiWrapperState {
    return {
      t: "PickupApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: PickupApiWrapperState): PickupApiWrapper | null {
    const resource = Game.getObjectById(state.i)
    if (resource == null) {
      return null
    }
    return new PickupApiWrapper(resource)
  }

  public static create(target: Resource): PickupApiWrapper {
    return new PickupApiWrapper(target)
  }

  public run(creep: Creep): PickupApiWrapperResult {
    const result = creep.pickup(this.target)

    switch (result) {
    case OK:
      return FINISHED_AND_RAN

    case ERR_FULL:
      return FINISHED

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`creep.pickup() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}, target: ${this.target}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
