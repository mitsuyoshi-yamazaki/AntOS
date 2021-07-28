import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { TaskTargetPosition } from "object_task/object_task_target_cache"
import { ResourceOperationApiWrapper } from "object_task/resource_operation_api_wrapper"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { V6Creep } from "prototype/creep"
import { EnergyChargeableStructure } from "prototype/room_object"
import { TRANSFER_RESOURCE_RANGE } from "utility/constants"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "TransferApiWrapper"

type TransferApiWrapperTargetType = AnyCreep | StructureStorage | EnergyChargeableStructure

export interface TransferApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "TransferApiWrapper"

  /** target id */
  i: Id<TransferApiWrapperTargetType>

  /** resource type */
  r: ResourceConstant
}

export class TransferApiWrapper implements CreepApiWrapper, TargetingApiWrapper, ResourceOperationApiWrapper {
  public readonly shortDescription: string
  public readonly resourceOperationDescription = "transfer"
  public readonly range = TRANSFER_RESOURCE_RANGE

  private constructor(
    public readonly target: TransferApiWrapperTargetType,
    public readonly resourceType: ResourceConstant,
  ) {
    this.shortDescription = `t-${this.resourceType}`
  }

  public encode(): TransferApiWrapperState {
    return {
      t: apiWrapperType,
      i: this.target.id,
      r: this.resourceType,
    }
  }

  public static decode(state: TransferApiWrapperState): TransferApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new TransferApiWrapper(target, state.r)
  }

  public static create(target: TransferApiWrapperTargetType, resourceType: ResourceConstant): TransferApiWrapper {
    return new TransferApiWrapper(target, resourceType)
  }

  public taskTarget(creep: V6Creep): TaskTargetPosition {
    return {
      taskTargetType: "position",
      position: this.target.pos,
      concreteTarget: this.target,
      taskType: "transfer",
      amount: creep.store.getUsedCapacity(this.resourceType),
    }
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    if (creep.store.getUsedCapacity(this.resourceType) <= 0) {
      return CreepApiWrapperProgress.Finished(false)
    }

    const result = creep.transfer(this.target, this.resourceType)

    switch (result) {
    case OK:
      return CreepApiWrapperProgress.Finished(true)

    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_FULL:
      return CreepApiWrapperProgress.Finished(false)

    case ERR_NOT_IN_RANGE:
      return CreepApiWrapperProgress.InProgress(true)

    case ERR_BUSY:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_INVALID_ARGS:
    default:
      return CreepApiWrapperProgress.Failed(new UnexpectedCreepProblem(creep.memory.p, creep.room.name, apiWrapperType, result))
    }
  }
}
