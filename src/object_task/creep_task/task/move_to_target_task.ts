import { ObjectTaskTarget } from "object_task/object_task"
import { isTargetingApiWrapper, TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { defaultMoveToOptions, V6Creep } from "prototype/creep"
import { MoveToApiWrapper, MoveToApiWrapperOptions, MoveToApiWrapperState } from "../api_wrapper/move_to_api_wrapper"
import { CreepApiWrapper, CreepApiWrapperState } from "../creep_api_wrapper"
import { decodeCreepApiWrapperFromState } from "../creep_api_wrapper_decoder"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

type MoveToTargetTaskApiWrapper = CreepApiWrapper & TargetingApiWrapper

export interface MoveToTargetTaskState extends CreepTaskState {
  /** type identifier */
  t: "MoveToTargetTask"

  /** api wrapper states */
  a: {
    /** targeting api wrapper state */
    t: CreepApiWrapperState

    /** moveTo api wrapper state */
    m: MoveToApiWrapperState
  }
}

export class MoveToTargetTask implements CreepTask {
  public readonly shortDescription: string
  public readonly targets: ObjectTaskTarget[] = []

  private constructor(
    public readonly startTime: number,
    public readonly targetingApiWrapper: MoveToTargetTaskApiWrapper,
    public readonly moveToApiWrapper: MoveToApiWrapper,
  ) {
    this.shortDescription = this.targetingApiWrapper.shortDescription
  }

  public encode(): MoveToTargetTaskState {
    return {
      t: "MoveToTargetTask",
      s: this.startTime,
      a: {
        t: this.targetingApiWrapper.encode(),
        m: this.moveToApiWrapper.encode(),
      },
    }
  }

  public static decode(state: MoveToTargetTaskState): MoveToTargetTask | null {
    const targetingApiWrapper = decodeCreepApiWrapperFromState(state.a.t)
    if (targetingApiWrapper == null || !isTargetingApiWrapper(targetingApiWrapper)) {
      return null
    }
    const moveToApiWrapper = MoveToApiWrapper.decode(state.a.m)
    return new MoveToTargetTask(state.s, targetingApiWrapper, moveToApiWrapper)
  }

  public static create(targetingApiWrapper: MoveToTargetTaskApiWrapper, moveToOptions?: MoveToApiWrapperOptions): MoveToTargetTask {
    const options: MoveToApiWrapperOptions = moveToOptions ?? defaultMoveToOptions
    if (options.range == null) {
      options.range = targetingApiWrapper.range
    }
    const moveToApiWrapper = MoveToApiWrapper.create(targetingApiWrapper.target.pos, options)
    return new MoveToTargetTask(Game.time, targetingApiWrapper, moveToApiWrapper)
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
    const result = this.moveToApiWrapper.run(creep)
    switch (result.apiWrapperProgressType) {
    case "in progress":
    case "finished":
      return CreepTaskProgress.InProgress([])
    case "failed":
      return CreepTaskProgress.InProgress([result.problem])
    }
  }
}
