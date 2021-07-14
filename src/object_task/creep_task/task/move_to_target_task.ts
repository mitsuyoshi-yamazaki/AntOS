import { isTargetingApiWrapper, TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { defaultMoveToOptions } from "prototype/creep"
import { CreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

type MoveToTargetTaskApiWrapper = CreepApiWrapper & TargetingApiWrapper

export interface MoveToTargetTaskState extends CreepTaskState {
  /** type identifier */
  t: "MoveToTargetTask"

  /** api wrapper state */
  st: CreepApiWrapperState
}

export class MoveToTargetTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly apiWrapper: MoveToTargetTaskApiWrapper,
  ) {
    this.shortDescription = this.apiWrapper.shortDescription
  }

  public encode(): MoveToTargetTaskState {
    return {
      t: "MoveToTargetTask",
      s: this.startTime,
      st: this.apiWrapper.encode(),
    }
  }

  public static decode(state: MoveToTargetTaskState): MoveToTargetTask | null {
    const apiWrapper = decodeCreepApiWrapperFromState(state.st)
    if (apiWrapper == null || !isTargetingApiWrapper(apiWrapper)) {
      return null
    }
    return new MoveToTargetTask(state.s, apiWrapper)
  }

  public static create(apiWrapper: MoveToTargetTaskApiWrapper): MoveToTargetTask {
    return new MoveToTargetTask(Game.time, apiWrapper)
  }

  public run(creep: Creep): CreepTaskProgress {
    const result = this.apiWrapper.run(creep)
    switch (result.apiWrapperProgressType) {
    case "in progress":
      if (result.notInRange === true) {
        creep.moveTo(this.apiWrapper.target, defaultMoveToOptions)
      }
      return CreepTaskProgress.InProgress([])

    case "finished":
      return CreepTaskProgress.Finished([])

    case "failed":
      return CreepTaskProgress.Finished([result.error])
    }
  }
}
