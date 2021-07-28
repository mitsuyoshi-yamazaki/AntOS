import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { TaskTargetPosition } from "object_task/object_task_target_cache"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { V6Creep } from "prototype/creep"
import { EnergyChargeableStructure } from "prototype/room_object"
import { TRANSFER_RESOURCE_RANGE } from "utility/constants"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "WithdrawApiWrapper"

type WithdrawApiWrapperTargetType = StructureStorage | EnergyChargeableStructure

export interface WithdrawApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "WithdrawApiWrapper"

  /** target id */
  i: Id<WithdrawApiWrapperTargetType>

  /** resource type */
  r: ResourceConstant
}

export class WithdrawApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription: string
  public readonly range = TRANSFER_RESOURCE_RANGE

  private constructor(
    public readonly target: WithdrawApiWrapperTargetType,
    public readonly resourceType: ResourceConstant,
  ) {
    this.shortDescription = `w-${this.resourceType}`
  }

  public encode(): WithdrawApiWrapperState {
    return {
      t: apiWrapperType,
      i: this.target.id,
      r: this.resourceType,
    }
  }

  public static decode(state: WithdrawApiWrapperState): WithdrawApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new WithdrawApiWrapper(target, state.r)
  }

  public static create(target: WithdrawApiWrapperTargetType, resourceType: ResourceConstant): WithdrawApiWrapper {
    return new WithdrawApiWrapper(target, resourceType)
  }

  public taskTarget(creep: V6Creep): TaskTargetPosition {
    return {
      taskTargetType: "position",
      position: this.target.pos,
      concreteTarget: this.target,
      taskType: "withdraw",
      amount: creep.store.getCapacity(),
    }
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    if (creep.store.getFreeCapacity(this.resourceType) <= 0) {
      return CreepApiWrapperProgress.Finished(false)
    }

    const result = creep.withdraw(this.target, this.resourceType)

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
