import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { EnergyChargeableStructure } from "prototype/room_object"

type TransferEnergyApiWrapperResult = FINISHED | FINISHED_AND_RAN | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR
export type TransferEnergyApiWrapperTargetType = AnyCreep | StructureStorage | StructureTerminal | EnergyChargeableStructure

export interface TransferEnergyApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<TransferEnergyApiWrapperTargetType>
}

export class TransferEnergyApiWrapper implements ApiWrapper<Creep, TransferEnergyApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "transfer"
  public readonly range = 1

  private constructor(
    public readonly target: TransferEnergyApiWrapperTargetType,
  ) { }

  public encode(): TransferEnergyApiWrapperState {
    return {
      t: "TransferEnergyApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: TransferEnergyApiWrapperState): TransferEnergyApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new TransferEnergyApiWrapper(source)
  }

  public static create(target: TransferEnergyApiWrapperTargetType): TransferEnergyApiWrapper {
    return new TransferEnergyApiWrapper(target)
  }

  public run(creep: Creep): TransferEnergyApiWrapperResult {
    const result = creep.transfer(this.target, RESOURCE_ENERGY)

    switch (result) {
    case OK:
      return FINISHED_AND_RAN

    case ERR_FULL:
    case ERR_NOT_ENOUGH_RESOURCES:
      return FINISHED

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_INVALID_ARGS:
    default:
      PrimitiveLogger.fatal(`creep.transfer() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
