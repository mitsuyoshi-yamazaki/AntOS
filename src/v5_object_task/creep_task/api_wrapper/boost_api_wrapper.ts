import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type BoostApiWrapperResult = FINISHED | IN_PROGRESS | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface BoostApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<StructureLab>
}

export class BoostApiWrapper implements ApiWrapper<Creep, BoostApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "boost"
  public readonly range = 1

  private constructor(
    public readonly target: StructureLab,
  ) { }

  public encode(): BoostApiWrapperState {
    return {
      t: "BoostApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: BoostApiWrapperState): BoostApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new BoostApiWrapper(target)
  }

  public static create(target: StructureLab): BoostApiWrapper {
    return new BoostApiWrapper(target)
  }

  public run(creep: Creep): BoostApiWrapperResult {
    if (creep.spawning === true) {
      return IN_PROGRESS
    }

    const result = this.target.boostCreep(creep)

    switch (result) {
    case OK:
      return FINISHED_AND_RAN

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_NOT_OWNER:
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
    case ERR_RCL_NOT_ENOUGH:
    default:
      PrimitiveLogger.fatal(`lab.boostCreep() returns ${result}, ${creep.name}, lab ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
