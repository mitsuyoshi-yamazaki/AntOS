import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { GameConstants } from "utility/constants"

type RepairApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface RepairApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<AnyStructure>
}

export class RepairApiWrapper implements ApiWrapper<Creep, RepairApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "repair"
  public readonly range = 1

  private constructor(
    public readonly target: AnyStructure,
  ) { }

  public encode(): RepairApiWrapperState {
    return {
      t: "RepairApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: RepairApiWrapperState): RepairApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new RepairApiWrapper(target)
  }

  public static create(target: AnyStructure): RepairApiWrapper {
    return new RepairApiWrapper(target)
  }

  public run(creep: Creep): RepairApiWrapperResult {
    const result = creep.repair(this.target)

    switch (result) {
    case OK: {
      const consumeAmount = creep.body.filter(b => b.type === WORK).length * GameConstants.creep.actionCost.repair
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
      PrimitiveLogger.fatal(`creep.repair() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
