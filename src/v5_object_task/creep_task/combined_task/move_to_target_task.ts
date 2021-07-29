import { defaultMoveToOptions, ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { TargetingApiWrapper, TargetingApiWrapperTargetType } from "v5_object_task/targeting_api_wrapper"
import { TaskProgressType } from "v5_object_task/object_task"
import { AnyCreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

type MoveToTargetTaskApiWrapper = AnyCreepApiWrapper & TargetingApiWrapper

export interface MoveToTargetTaskOptions {
  ignoreSwamp: boolean
}

const defaultOptions: MoveToTargetTaskOptions = {
  ignoreSwamp: false
}

export interface MoveToTargetTaskState extends CreepTaskState {
  /** api warpper state */
  as: CreepApiWrapperState

  /** ignore swamp */
  is: boolean
}

export class MoveToTargetTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<TargetingApiWrapperTargetType> {
    return this.apiWrapper.target.id
  }

  private constructor(
    public readonly startTime: number,
    private readonly apiWrapper: MoveToTargetTaskApiWrapper,
    private readonly options: MoveToTargetTaskOptions,
  ) {
    this.shortDescription = apiWrapper.shortDescription
  }

  public encode(): MoveToTargetTaskState {
    return {
      s: this.startTime,
      t: "MoveToTargetTask",
      as: this.apiWrapper.encode(),
      is: this.options.ignoreSwamp,
    }
  }

  public static decode(state: MoveToTargetTaskState): MoveToTargetTask | null {
    const wrapper = decodeCreepApiWrapperFromState(state.as)
    if (wrapper == null) {
      return null
    }
    const options: MoveToTargetTaskOptions = {
      ignoreSwamp: state.is ?? false  // migration
    }
    return new MoveToTargetTask(state.s, wrapper as MoveToTargetTaskApiWrapper, options)
  }

  public static create(apiWrapper: MoveToTargetTaskApiWrapper, options?: MoveToTargetTaskOptions): MoveToTargetTask {
    return new MoveToTargetTask(Game.time, apiWrapper, options ?? defaultOptions)
  }

  public run(creep: Creep): TaskProgressType {
    const result = this.apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
      return TaskProgressType.Finished

    case FINISHED_AND_RAN:
      return TaskProgressType.FinishedAndRan

    case IN_PROGRESS:
    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.apiWrapper.target, this.moveToOpts(creep, this.apiWrapper.range))
      return TaskProgressType.InProgress

    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_DAMAGED:
      return TaskProgressType.Finished

    case ERR_BUSY:
      return TaskProgressType.InProgress

    case ERR_PROGRAMMING_ERROR:
      return TaskProgressType.Finished
    }
  }

  private moveToOpts(creep: Creep, range: number): MoveToOpts {
    if (["W1S25", "W2S25", "W27S25"].includes(creep.room.name)) { // FixMe:
      return {
        maxRooms: 1,
        reusePath: 10,
        maxOps: 4000,
        range,
      }
    }
    const options = defaultMoveToOptions
    options.range = range
    if (this.options.ignoreSwamp === true) {
      options.ignoreRoads = true
      options.swampCost = 1
    }
    return options
  }
}
