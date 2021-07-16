import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"

type TransferResourceApiWrapperResult = FINISHED | FINISHED_AND_RAN | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR
export type TransferResourceApiWrapperTargetType = AnyCreep | StructureContainer | StructureStorage | StructureTerminal | StructureSpawn | StructureExtension | StructureTower | StructurePowerSpawn

export interface TransferResourceApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<TransferResourceApiWrapperTargetType>

  /** resource type */
  r: ResourceConstant
}

export class TransferResourceApiWrapper implements ApiWrapper<Creep, TransferResourceApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "transfer"

  private constructor(
    public readonly target: TransferResourceApiWrapperTargetType,
    public readonly resourceType: ResourceConstant,
  ) { }

  public encode(): TransferResourceApiWrapperState {
    return {
      t: "TransferResourceApiWrapper",
      i: this.target.id,
      r: this.resourceType,
    }
  }

  public static decode(state: TransferResourceApiWrapperState): TransferResourceApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new TransferResourceApiWrapper(target, state.r)
  }

  public static create(target: TransferResourceApiWrapperTargetType, resourceType: ResourceConstant): TransferResourceApiWrapper {
    return new TransferResourceApiWrapper(target, resourceType)
  }

  public run(creep: Creep): TransferResourceApiWrapperResult {
    const result = creep.transfer(this.target, this.resourceType)

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
