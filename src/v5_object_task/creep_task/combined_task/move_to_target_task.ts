import { defaultMoveToOptions, ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { TargetingApiWrapper, TargetingApiWrapperTargetType } from "v5_object_task/targeting_api_wrapper"
import { TaskProgressType } from "v5_object_task/object_task"
import { AnyCreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { Timestamp } from "utility/timestamp"

type MoveToTargetTaskApiWrapper = AnyCreepApiWrapper & TargetingApiWrapper
type Position = {
  position: RoomPosition,
  timestamp: Timestamp
}
type PositionState = {
  position: RoomPositionState,
  timestamp: Timestamp,
}

export interface MoveToTargetTaskOptions {
  ignoreSwamp: boolean
  reusePath: number | null
}

export interface MoveToTargetTaskState extends CreepTaskState {
  /** api warpper state */
  as: CreepApiWrapperState

  /** ignore swamp */
  is: boolean

  lastPosition: PositionState | null
  reusePath: number | null
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
    private lastPosition: Position | null,
  ) {
    this.shortDescription = apiWrapper.shortDescription
  }

  public encode(): MoveToTargetTaskState {
    return {
      s: this.startTime,
      t: "MoveToTargetTask",
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

  public static decode(state: MoveToTargetTaskState): MoveToTargetTask | null {
    const wrapper = decodeCreepApiWrapperFromState(state.as)
    if (wrapper == null) {
      return null
    }
    const options: MoveToTargetTaskOptions = {
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
    return new MoveToTargetTask(state.s, wrapper as MoveToTargetTaskApiWrapper, options, lastPosition)
  }

  public static create(apiWrapper: MoveToTargetTaskApiWrapper, options?: MoveToTargetTaskOptions): MoveToTargetTask {
    const opt = ((): MoveToTargetTaskOptions => {
      if (options != null) {
        return options
      }
      return {
        ignoreSwamp: false,
        reusePath: null,
      }
    })()
    return new MoveToTargetTask(Game.time, apiWrapper, opt, null)
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
      creep.moveTo(this.apiWrapper.target, this.moveToOpts(creep, this.apiWrapper.range, this.apiWrapper.target.pos))
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

  private moveToOpts(creep: Creep, range: number, targetPosition: RoomPosition): MoveToOpts {
    if (this.lastPosition != null) {
      if (this.lastPosition.position.isEqualTo(creep.pos) === true) {
        if ((Game.time - this.lastPosition.timestamp) > 2) {
          const maxRooms = creep.pos.roomName === targetPosition.roomName ? 1 : 2
          const maxOps = creep.pos.roomName === targetPosition.roomName ? 1500 : 2000
          return {
            maxRooms,
            reusePath: this.options.reusePath ?? 3,
            maxOps,
            range,
          }
        } else {
          if (creep.fatigue > 0) {
            this.lastPosition.timestamp += 1
          }
        }
      } else {
        this.lastPosition = {
          position: creep.pos,
          timestamp: Game.time
        }
      }
    } else {
      this.lastPosition = {
        position: creep.pos,
        timestamp: Game.time
      }
    }

    const inEconomicArea = ((): boolean => {
      if (creep.room.controller == null) {
        return false
      }
      if (creep.room.controller.my === true) {
        return true
      }
      if (creep.room.controller.reservation == null) {
        return false
      }
      if (creep.room.controller.reservation.username === Game.user.name) {
        return true
      }
      return false
    })()

    if (["W1S25", "W2S25", "W27S25"].includes(creep.room.name)) { // FixMe:
      const maxRooms = creep.pos.roomName === targetPosition.roomName ? 1 : 2
      const reusePath = ((): number => {
        if (this.options.reusePath != null) {
          return this.options.reusePath
        }
        return inEconomicArea === true ? 100 : 3
      })()
      return {
        maxRooms,
        reusePath,
        maxOps: 4000,
        range,
        ignoreCreeps: inEconomicArea === true ? true : false,
      }
    }

    const reusePath = ((): number => {
      if (this.options.reusePath != null) {
        return this.options.reusePath
      }
      return inEconomicArea === true ? 100 : 0
    })()

    const options = defaultMoveToOptions()
    options.range = range
    options.maxRooms = creep.pos.roomName === targetPosition.roomName ? 1 : 2
    options.maxOps = creep.pos.roomName === targetPosition.roomName ? 500 : 1500
    options.reusePath = reusePath,
    options.ignoreCreeps = inEconomicArea === true ? true : false
    if (this.options.ignoreSwamp === true) {
      options.ignoreRoads = true
      options.swampCost = 1
    }
    return options
  }
}
