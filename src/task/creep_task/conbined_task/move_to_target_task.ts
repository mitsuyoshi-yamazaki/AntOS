import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, IN_PROGRESS } from "prototype/creep"
import { TargetingApiWrapper, TargetingApiWrapperTargetType } from "task/targeting_api_wrapper"
import { TaskProgressType, taskProgressTypeFinished, taskProgressTypeInProgress } from "task/task"
import { CreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask, CreepTaskState } from "../creep_task"

type MoveToTargetTaskApiWrapperResult = FINISHED | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR
type MoveToTargetTaskApiWrapper = CreepApiWrapper<MoveToTargetTaskApiWrapperResult> & TargetingApiWrapper

export interface MoveToTargetTaskState extends CreepTaskState {
  /** api warpper state */
  as: CreepApiWrapperState
}

export class MoveToTargetTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<TargetingApiWrapperTargetType> {
    return this.apiWrapper.target.id
  }

  private constructor(
    public readonly startTime: number,
    private readonly apiWrapper: MoveToTargetTaskApiWrapper,
  ) {
    this.shortDescription = apiWrapper.shortDescription
  }

  public encode(): MoveToTargetTaskState {
    return {
      s: this.startTime,
      t: "MoveToTargetTask",
      as: this.apiWrapper.encode(),
    }
  }

  public static decode(state: MoveToTargetTaskState): MoveToTargetTask | null {
    const wrapper = decodeCreepApiWrapperFromState(state.as)
    if (wrapper == null) {
      return null
    }
    return new MoveToTargetTask(state.s, wrapper as MoveToTargetTaskApiWrapper)
  }

  public static create(apiWrapper: MoveToTargetTaskApiWrapper): MoveToTargetTask {
    return new MoveToTargetTask(Game.time, apiWrapper)
  }

  public run(creep: Creep): TaskProgressType {
    const result = this.apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
      return taskProgressTypeFinished

    case IN_PROGRESS:
    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.apiWrapper.target, {reusePath: 1})
      return taskProgressTypeInProgress

    case ERR_DAMAGED:
      return taskProgressTypeFinished

    case ERR_BUSY:
      return taskProgressTypeInProgress

    case ERR_PROGRAMMING_ERROR:
      return taskProgressTypeFinished
    }
  }
}
