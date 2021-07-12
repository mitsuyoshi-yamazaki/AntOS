import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "object_task/api_wrapper"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type BuildApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface BuildApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<ConstructionSite<BuildableStructureConstant>>
}

export class BuildApiWrapper implements ApiWrapper<Creep, BuildApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "build"

  private constructor(
    public readonly target: ConstructionSite<BuildableStructureConstant>,
  ) { }

  public encode(): BuildApiWrapperState {
    return {
      t: "BuildApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: BuildApiWrapperState): BuildApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new BuildApiWrapper(target)
  }

  public static create(target: ConstructionSite<BuildableStructureConstant>): BuildApiWrapper {
    return new BuildApiWrapper(target)
  }

  public run(creep: Creep): BuildApiWrapperResult {
    const result = creep.build(this.target)

    switch (result) {
    case OK: {
      const consumeAmount = creep.body.filter(b => b.type === WORK).length * BUILD_POWER
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= consumeAmount) {
        return FINISHED_AND_RAN
      }
      return IN_PROGRESS
    }

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_NOT_ENOUGH_RESOURCES:
      return FINISHED

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NO_BODYPART:
      return ERR_DAMAGED

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`creep.build() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
