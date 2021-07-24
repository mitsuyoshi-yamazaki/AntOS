import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { TaskTargetPosition } from "object_task/object_task_target_cache"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { V6Creep } from "prototype/creep"
import { GameConstants } from "utility/constants"
import { bodyPower } from "utility/creep_body"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "BuildApiWrapper"

export interface BuildApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "BuildApiWrapper"

  /** target id */
  i: Id<ConstructionSite<BuildableStructureConstant>>
}

export class BuildApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription = "build"
  public readonly range = GameConstants.creep.actionRange.build

  private constructor(
    public readonly target: ConstructionSite<BuildableStructureConstant>,
  ) {
  }

  public encode(): BuildApiWrapperState {
    return {
      t: apiWrapperType,
      i: this.target.id,
    }
  }

  public static decode(state: BuildApiWrapperState): BuildApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new BuildApiWrapper(target)
  }

  public static create(target: ConstructionSite<BuildableStructureConstant>): BuildApiWrapper {
    return new BuildApiWrapper(target)
  }

  public taskTarget(creep: V6Creep): TaskTargetPosition {
    return {
      taskTargetType: "position",
      position: this.target.pos,
      concreteTarget: this.target,
      taskType: "build",
      amount: bodyPower(creep.body, "build"),
    }
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    const result = creep.build(this.target)

    switch (result) {
    case OK: {
      const buildAmount = creep.body.filter(b => b.type === WORK).length * GameConstants.creep.actionPower.build
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= buildAmount) {
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
