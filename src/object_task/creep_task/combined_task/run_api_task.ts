import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { isTargetingApiWrapper, TargetingApiWrapperTargetType } from "object_task/targeting_api_wrapper"
import { TaskProgressType } from "object_task/object_task"
import { AnyCreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask, CreepTaskState } from "../creep_task"

export interface RunApiTaskState extends CreepTaskState {
  /** api warpper state */
  as: CreepApiWrapperState
}

export class RunApiTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<TargetingApiWrapperTargetType> | undefined {
    if (isTargetingApiWrapper(this.apiWrapper)) {
      return this.apiWrapper.target.id
    }
    return undefined
  }

  private constructor(
    public readonly startTime: number,
    private readonly apiWrapper: AnyCreepApiWrapper,
  ) {
    this.shortDescription = apiWrapper.shortDescription
  }

  public encode(): RunApiTaskState {
    return {
      s: this.startTime,
      t: "RunApiTask",
      as: this.apiWrapper.encode(),
    }
  }

  public static decode(state: RunApiTaskState): RunApiTask | null {
    const wrapper = decodeCreepApiWrapperFromState(state.as)
    if (wrapper == null) {
      return null
    }
    return new RunApiTask(state.s, wrapper)
  }

  public static create(apiWrapper: AnyCreepApiWrapper): RunApiTask {
    return new RunApiTask(Game.time, apiWrapper)
  }

  public run(creep: Creep): TaskProgressType {
    const result = this.apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
      return TaskProgressType.Finished

    case FINISHED_AND_RAN:
      return TaskProgressType.FinishedAndRan

    case IN_PROGRESS:
    case ERR_BUSY:
      return TaskProgressType.InProgress

    case ERR_NOT_IN_RANGE:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_DAMAGED:
    case ERR_PROGRAMMING_ERROR:
      return TaskProgressType.Finished
    }
  }
}
