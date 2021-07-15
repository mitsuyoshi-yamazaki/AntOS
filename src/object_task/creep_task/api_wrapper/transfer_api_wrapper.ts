import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { V6Creep } from "prototype/creep"
import { TRANSFER_RESOURCE_RANGE } from "utility/constants"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "TransferApiWrapper"

type TransferApiWrapperTargetType = AnyCreep | StructureContainer | StructureStorage | StructureTerminal | StructureSpawn | StructureExtension | StructureTower

export interface TransferApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "TransferApiWrapper"

  /** target id */
  i: Id<TransferApiWrapperTargetType>

  /** resource type */
  r: ResourceConstant
}

export class TransferApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription: string
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

    // case ERR_NOT_OWNER:
    // case ERR_INVALID_TARGET:
    // case ERR_INVALID_ARGS:
    // default:
    //   return CreepApiWrapperProgress.Failed(apiWrapperType, creep.name, result)
    }
    return CreepApiWrapperProgress.InProgress(false) // FixMe:

  }
}
