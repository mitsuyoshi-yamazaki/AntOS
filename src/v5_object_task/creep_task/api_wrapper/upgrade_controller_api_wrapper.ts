import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type UpgradeControllerApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface UpgradeControllerApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<StructureController>
}

export class UpgradeControllerApiWrapper implements ApiWrapper<Creep, UpgradeControllerApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "upgrade"
  private constructor(
    public readonly target: StructureController,
  ) { }

  public encode(): UpgradeControllerApiWrapperState {
    return {
      t: "UpgradeControllerApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: UpgradeControllerApiWrapperState): UpgradeControllerApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new UpgradeControllerApiWrapper(source)
  }

  public static create(target: StructureController): UpgradeControllerApiWrapper {
    return new UpgradeControllerApiWrapper(target)
  }

  public run(creep: Creep): UpgradeControllerApiWrapperResult {
    const result = creep.upgradeController(this.target)

    switch (result) {
    case OK: {
      const consumeAmount = creep.body.filter(b => b.type === WORK).length * UPGRADE_CONTROLLER_POWER
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= consumeAmount) {
        return FINISHED_AND_RAN
      }
      return IN_PROGRESS
    }

    case ERR_NOT_ENOUGH_RESOURCES:
      return FINISHED

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NO_BODYPART:
      return ERR_DAMAGED

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`creep.transfer() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
