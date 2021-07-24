import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { TaskTargetPosition } from "object_task/object_task_target_cache"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { V6Creep } from "prototype/creep"
import { GameConstants } from "utility/constants"
import { bodyPower } from "utility/creep_body"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "UpgradeControllerApiWrapper"

export interface UpgradeControllerApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "UpgradeControllerApiWrapper"

  /** target id */
  i: Id<StructureController>
}

export class UpgradeControllerApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription = "upgrade"
  public readonly range = GameConstants.creep.actionRange.upgradeController

  private constructor(
    public readonly target: StructureController,
  ) {
  }

  public encode(): UpgradeControllerApiWrapperState {
    return {
      t: apiWrapperType,
      i: this.target.id,
    }
  }

  public static decode(state: UpgradeControllerApiWrapperState): UpgradeControllerApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new UpgradeControllerApiWrapper(target)
  }

  public static create(target: StructureController): UpgradeControllerApiWrapper {
    return new UpgradeControllerApiWrapper(target)
  }

  public taskTarget(creep: V6Creep): TaskTargetPosition {
    return {
      taskTargetType: "position",
      position: this.target.pos,
      concreteTarget: this.target,
      taskType: "upgradeController",
      amount: bodyPower(creep.body, "upgradeController"),
    }
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    const result = creep.upgradeController(this.target)

    switch (result) {
    case OK: {
      const upgradeAmount = creep.body.filter(b => b.type === WORK).length * GameConstants.creep.actionPower.upgradeController
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= upgradeAmount) {
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
