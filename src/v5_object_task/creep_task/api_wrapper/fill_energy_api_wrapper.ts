import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { GameConstants } from "utility/constants"

type FillEnergyApiWrapperResult = FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_NOT_ENOUGH_RESOURCES | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR
type FillEnergyApiWrapperTargetType = StructureLink

export interface FillEnergyApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<FillEnergyApiWrapperTargetType>
}

export class FillEnergyApiWrapper implements ApiWrapper<Creep, FillEnergyApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "fill"
  public readonly range = 1

  private constructor(
    public readonly target: FillEnergyApiWrapperTargetType,
  ) { }

  public encode(): FillEnergyApiWrapperState {
    return {
      t: "FillEnergyApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: FillEnergyApiWrapperState): FillEnergyApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new FillEnergyApiWrapper(target)
  }

  public static create(target: FillEnergyApiWrapperTargetType): FillEnergyApiWrapper {
    return new FillEnergyApiWrapper(target)
  }

  public run(creep: Creep): FillEnergyApiWrapperResult {
    if (this.target.store.getFreeCapacity(RESOURCE_ENERGY) < (creep.store.getCapacity() * 0.5)) {
      return IN_PROGRESS
    }

    const harvestPower = creep.getActiveBodyparts(WORK) * GameConstants.creep.actionPower.harvestEnergy
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > harvestPower) {
      return IN_PROGRESS
    }
    const result = creep.transfer(this.target, RESOURCE_ENERGY)

    switch (result) {
    case OK:
      return IN_PROGRESS

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_NOT_OWNER:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_INVALID_TARGET:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
    default:
      if ((Game.time % 19) === 7) {
        PrimitiveLogger.fatal(`creep.transfer() to ${this.target} returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      }
      return ERR_PROGRAMMING_ERROR
    }
  }
}
