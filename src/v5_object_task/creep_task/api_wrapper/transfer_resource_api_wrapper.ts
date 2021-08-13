import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { EnergyChargeableStructure } from "prototype/room_object"

type TransferResourceApiWrapperResult = FINISHED | FINISHED_AND_RAN | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR
export type TransferResourceApiWrapperTargetType = AnyCreep | StructureStorage | EnergyChargeableStructure

export interface TransferResourceApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<TransferResourceApiWrapperTargetType>

  /** resource type */
  r: ResourceConstant

  amount: number | null
}

export class TransferResourceApiWrapper implements ApiWrapper<Creep, TransferResourceApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "transfer"
  public readonly range = 1

  private constructor(
    public readonly target: TransferResourceApiWrapperTargetType,
    public readonly resourceType: ResourceConstant,
    public readonly amount: number | null,
  ) { }

  public encode(): TransferResourceApiWrapperState {
    return {
      t: "TransferResourceApiWrapper",
      i: this.target.id,
      r: this.resourceType,
      amount: this.amount,
    }
  }

  public static decode(state: TransferResourceApiWrapperState): TransferResourceApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new TransferResourceApiWrapper(target, state.r, state.amount ?? null)
  }

  public static create(target: TransferResourceApiWrapperTargetType, resourceType: ResourceConstant, amount?: number): TransferResourceApiWrapper {
    return new TransferResourceApiWrapper(target, resourceType, amount ?? null)
  }

  public run(creep: Creep): TransferResourceApiWrapperResult {
    const freeCapacity = this.target.store.getFreeCapacity(this.resourceType)
    if (freeCapacity != null && freeCapacity <= 0) {
      return FINISHED
    }

    const result = creep.transfer(this.target, this.resourceType, this.amount ?? undefined)

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
