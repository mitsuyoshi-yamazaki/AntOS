import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { TargetingApiWrapper, TargetingApiWrapperTargetType } from "v5_object_task/targeting_api_wrapper"
import { TaskProgressType } from "v5_object_task/object_task"
import { AnyCreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { Timestamp } from "utility/timestamp"
import { travelTo, TravelToOptions } from "prototype/travel_to"

type TravelToTargetTaskApiWrapper = AnyCreepApiWrapper & TargetingApiWrapper
type Position = {
  position: RoomPosition,
  timestamp: Timestamp
}
type PositionState = {
  position: RoomPositionState,
  timestamp: Timestamp,
}

export interface TravelToTargetTaskOptions {
  ignoreSwamp: boolean
  reusePath: number | null
}

export interface TravelToTargetTaskState extends CreepTaskState {
  /** api warpper state */
  as: CreepApiWrapperState

  /** ignore swamp */
  is: boolean

  lastPosition: PositionState | null
  reusePath: number | null
}

export class TravelToTargetTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<TargetingApiWrapperTargetType> {
    return this.apiWrapper.target.id
  }

  private constructor(
    public readonly startTime: number,
    public readonly apiWrapper: TravelToTargetTaskApiWrapper,
    private readonly options: TravelToTargetTaskOptions,
    private lastPosition: Position | null,
  ) {
    this.shortDescription = apiWrapper.shortDescription
  }

  public encode(): TravelToTargetTaskState {
    return {
      s: this.startTime,
      t: "TravelToTargetTask",
      as: this.apiWrapper.encode(),
      is: this.options.ignoreSwamp ?? false,
      reusePath: this.options.reusePath ?? null,
      lastPosition: ((): PositionState | null => {
        if (this.lastPosition == null) {
          return null
        }
        return {
          position: this.lastPosition.position.encode(),
          timestamp: this.lastPosition.timestamp,
        }
      })(),
    }
  }

  public static decode(state: TravelToTargetTaskState): TravelToTargetTask | null {
    const wrapper = decodeCreepApiWrapperFromState(state.as)
    if (wrapper == null) {
      return null
    }
    const options: TravelToTargetTaskOptions = {
      ignoreSwamp: state.is,
      reusePath: state.reusePath,
    }
    const lastPosition = ((): Position | null => {
      if (state.lastPosition == null) {
        return null
      }
      return {
        position: decodeRoomPosition(state.lastPosition.position),
        timestamp: state.lastPosition.timestamp,
      }
    })()
    return new TravelToTargetTask(state.s, wrapper as TravelToTargetTaskApiWrapper, options, lastPosition)
  }

  public static create(apiWrapper: TravelToTargetTaskApiWrapper, options?: TravelToTargetTaskOptions): TravelToTargetTask {
    const opt = ((): TravelToTargetTaskOptions => {
      if (options != null) {
        return options
      }
      return {
        ignoreSwamp: false,
        reusePath: null,
      }
    })()
    return new TravelToTargetTask(Game.time, apiWrapper, opt, null)
  }

  public run(creep: Creep): TaskProgressType {
    const result = this.apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
      return TaskProgressType.Finished

    case FINISHED_AND_RAN:
      return TaskProgressType.FinishedAndRan

    case IN_PROGRESS:
    case ERR_NOT_IN_RANGE: {
      const travelToOptions: TravelToOptions = {
        range: this.apiWrapper.range,
        cachePath: true,
        showPath: true,
      }
      travelTo(creep, this.apiWrapper.target.pos, travelToOptions)
      return TaskProgressType.InProgress
    }

    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_DAMAGED:
      return TaskProgressType.Finished

    case ERR_BUSY:
      return TaskProgressType.InProgress

    case ERR_PROGRAMMING_ERROR:
      return TaskProgressType.Finished
    }
  }
}
