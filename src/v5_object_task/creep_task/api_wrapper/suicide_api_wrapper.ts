import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED_AND_RAN } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type SuicideApiWrapperResult = FINISHED_AND_RAN | ERR_PROGRAMMING_ERROR

export interface SuicideApiWrapperState extends CreepApiWrapperState {
}

export class SuicideApiWrapper implements ApiWrapper<Creep, SuicideApiWrapperResult> {
  public readonly shortDescription = "suicide"

  private constructor(
  ) { }

  public encode(): SuicideApiWrapperState {
    return {
      t: "SuicideApiWrapper",
    }
  }

  public static decode(): SuicideApiWrapper {
    return new SuicideApiWrapper()
  }

  public static create(): SuicideApiWrapper {
    return new SuicideApiWrapper()
  }

  public run(creep: Creep): SuicideApiWrapperResult {
    if (creep.store.getUsedCapacity() > 0) {
      PrimitiveLogger.fatal(`Trying suicide creep ${creep.name} with carrying in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }

    const result = creep.suicide()

    switch (result) {
    case OK:
      return FINISHED_AND_RAN

    case ERR_NOT_OWNER:
    case ERR_BUSY:
    default:
      PrimitiveLogger.fatal(`creep.suicide() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
