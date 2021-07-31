import type { TaskTarget } from "object_task/object_task_target_cache"
import { isTargetingApiWrapper, TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import type { V6Creep } from "prototype/creep"
import { MoveToApiOptions } from "../api_wrapper/move_to_api_options"
import { CreepApiWrapper, CreepApiWrapperState } from "../creep_api_wrapper"
import { decodeCreepApiWrapperFromState } from "../creep_api_wrapper_decoder"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { MoveToPositionTask, MoveToPositionTaskState } from "./move_to_position_task"

type MoveToTargetTaskApiWrapper = CreepApiWrapper & TargetingApiWrapper

export interface MoveToTargetTaskState extends CreepTaskState {
  /** type identifier */
  t: "MoveToTargetTask"

  /** api wrapper states */
  a: {
    /** targeting api wrapper state */
    t: CreepApiWrapperState
  }

  moveToPositionTaskState: MoveToPositionTaskState
}

export class MoveToTargetTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly targetingApiWrapper: MoveToTargetTaskApiWrapper,
    public readonly moveToPositionTask: MoveToPositionTask,
  ) {
    this.shortDescription = this.targetingApiWrapper.shortDescription
  }

  public encode(): MoveToTargetTaskState {
    return {
      t: "MoveToTargetTask",
      s: this.startTime,
      a: {
        t: this.targetingApiWrapper.encode(),
      },
      moveToPositionTaskState: this.moveToPositionTask.encode(),
    }
  }

  public static decode(state: MoveToTargetTaskState): MoveToTargetTask | null {
    const targetingApiWrapper = decodeCreepApiWrapperFromState(state.a.t)
    if (targetingApiWrapper == null || !isTargetingApiWrapper(targetingApiWrapper)) {
      return null
    }
    const moveToPositionTask = MoveToPositionTask.decode(state.moveToPositionTaskState)
    return new MoveToTargetTask(state.s, targetingApiWrapper, moveToPositionTask)
  }

  public static create(targetingApiWrapper: MoveToTargetTaskApiWrapper, moveToOptions?: MoveToApiOptions): MoveToTargetTask {
    const position = ((): RoomPosition => {
      if (targetingApiWrapper.target instanceof RoomObject) {
        return targetingApiWrapper.target.pos
      }
      return targetingApiWrapper.target
    })()
    const moveToPositionTask = MoveToPositionTask.create(position, targetingApiWrapper.range, moveToOptions)
    return new MoveToTargetTask(Game.time, targetingApiWrapper, moveToPositionTask)
  }

  public taskTargets(creep: V6Creep): TaskTarget[] {
    return [
      this.targetingApiWrapper.taskTarget(creep),
      ...this.moveToPositionTask.taskTargets(),
    ]
  }

  public run(creep: V6Creep): CreepTaskProgress {
    const result = this.targetingApiWrapper.run(creep)
    switch (result.apiWrapperProgressType) {
    case "in progress":
      if (result.notInRange === true) {
        return this.move(creep)
      }
      return CreepTaskProgress.InProgress([])

    case "finished":
      return CreepTaskProgress.Finished([])

    case "failed":
      return CreepTaskProgress.Finished([result.problem])
    }
  }

  private move(creep: V6Creep): CreepTaskProgress {
    return this.moveToPositionTask.run(creep)
  }
}
