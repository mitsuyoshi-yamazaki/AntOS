import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { TaskTargetPosition } from "object_task/object_task_target_cache"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { V6Creep } from "prototype/creep"
import { REPAIR_RANGE } from "utility/constants"
import { bodyPower } from "utility/creep_body"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "RepairApiWrapper"

export interface RepairApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "RepairApiWrapper"

  /** target id */
  i: Id<AnyStructure>
}

export class RepairApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription = "repair"
  public readonly range = REPAIR_RANGE

  private constructor(
    public readonly target: AnyStructure,
  ) {
  }

  public encode(): RepairApiWrapperState {
    return {
      t: apiWrapperType,
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

  public taskTarget(creep: V6Creep): TaskTargetPosition {
    return {
      taskTargetType: "position",
      position: this.target.pos,
      concreteTarget: this.target,
      taskType: "repair",
      amount: bodyPower(creep.body, "repair"),
    }
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    if (this.target.hits >= this.target.hitsMax) {
      return CreepApiWrapperProgress.Finished(false)
    }

    const result = creep.repair(this.target)

    switch (result) {
    case OK: {
      const repairAmount = creep.body.filter(b => b.type === WORK).length * REPAIR_POWER
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= repairAmount) {
        return CreepApiWrapperProgress.Finished(true)
      } else {
        return CreepApiWrapperProgress.InProgress(false)
      }
    }

    case ERR_NOT_ENOUGH_RESOURCES:
      return CreepApiWrapperProgress.Finished(false)

    case ERR_NOT_IN_RANGE:
      return CreepApiWrapperProgress.InProgress(true)

    case ERR_BUSY:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    default:
      return CreepApiWrapperProgress.Failed(new UnexpectedCreepProblem(creep.memory.p, creep.room.name, apiWrapperType, result))
    }
  }
}
