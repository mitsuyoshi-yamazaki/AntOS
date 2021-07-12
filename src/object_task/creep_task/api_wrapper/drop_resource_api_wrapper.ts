import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { ApiWrapper } from "object_task/api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type DropResourceApiWrapperResult = FINISHED | FINISHED_AND_RAN | ERR_BUSY | ERR_PROGRAMMING_ERROR

export interface DropResourceApiWrapperState extends CreepApiWrapperState {
  /** resource type */
  r: ResourceConstant
}

export class DropResourceApiWrapper implements ApiWrapper<Creep, DropResourceApiWrapperResult> {
  public readonly shortDescription = "drop"

  private constructor(
    public readonly resourceType: ResourceConstant
  ) { }

  public encode(): DropResourceApiWrapperState {
    return {
      t: "DropResourceApiWrapper",
      r: this.resourceType,
    }
  }

  public static decode(state: DropResourceApiWrapperState): DropResourceApiWrapper | null {
    return new DropResourceApiWrapper(state.r)
  }

  public static create(resourceType: ResourceConstant): DropResourceApiWrapper {
    return new DropResourceApiWrapper(resourceType)
  }

  public run(creep: Creep): DropResourceApiWrapperResult {
    const result = creep.drop(this.resourceType)

    switch (result) {
    case OK:
      return FINISHED_AND_RAN

    case ERR_NOT_ENOUGH_RESOURCES:
      return FINISHED

    case ERR_BUSY:
      return ERR_BUSY

    // case ERR_INVALID_ARGS: // Docsには記載があるがtypesに入っていないようだ
    case ERR_NOT_OWNER:
    default:
      PrimitiveLogger.fatal(`creep.drop() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
