import { CreepDamagedProblem } from "application/problem/creep/creep_damaged_problem"
import { PathNotFoundProblem } from "application/problem/creep/path_not_found_problem"
import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { TaskTargetPosition } from "object_task/object_task_target_cache"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { defaultMoveToOptions, moveToOptions, V6Creep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { Timestamp } from "utility/timestamp"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"
import { MoveToApiOptions } from "./move_to_api_options"

const apiWrapperType = "MoveToPositionApiWrapper"
type Position = {
  position: RoomPosition,
  timestamp: Timestamp,
}
type PositionState = {
  position: RoomPositionState,
  timestamp: Timestamp,
}

export interface MoveToPositionApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "MoveToPositionApiWrapper"

  /** room position */
  p: RoomPositionState

  /** options */
  o: MoveToApiOptions

  lastPosition: PositionState | null
}

// TODO: 動いていないことを検出する
// TODO: Sourceなどは隣接セルに対して移動する・targetedByにあと何tickで移動するかがamountで入っていれば
export class MoveToPositionApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription: string
  public readonly range = 0

  private constructor(
    public readonly target: RoomPosition,
    public readonly options: MoveToApiOptions,
    private lastPosition: Position | null,
  ) {
    this.shortDescription = `${this.target.x},${this.target.y}`
  }

  public encode(): MoveToPositionApiWrapperState {
    return {
      t: apiWrapperType,
      p: this.target.encode(),
      o: this.options,
      lastPosition: ((): PositionState | null => {
        if (this.lastPosition == null) {
          return null
        }
        return {
          position: this.lastPosition.position.encode(),
          timestamp: this.lastPosition.timestamp,
        }
      })()
    }
  }

  public static decode(state: MoveToPositionApiWrapperState): MoveToPositionApiWrapper {
    const position = decodeRoomPosition(state.p)
    const lastPosition = ((): Position | null => {
      if (state.lastPosition == null) {
        return null
      }
      return {
        position: decodeRoomPosition(state.lastPosition.position),
        timestamp: state.lastPosition.timestamp,
      }
    })()
    return new MoveToPositionApiWrapper(position, state.o, lastPosition)
  }

  public static create(position: RoomPosition, options?: MoveToApiOptions): MoveToPositionApiWrapper {
    return new MoveToPositionApiWrapper(position, options ?? defaultMoveToOptions(), null)
  }

  public taskTarget(): TaskTargetPosition {
    return {
      taskTargetType: "position",
      position: this.target,
      concreteTarget: null,
      taskType: "move",
      amount: 0,  // TODO: どれだけ滞在するかわかれば
    }
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    if (creep.pos.isEqualTo(this.target) === true) {
      return CreepApiWrapperProgress.Finished(false)
    }

    const staying = ((): number => {
      if (this.lastPosition == null) {
        return 0
      }
      if (this.lastPosition.position.isEqualTo(creep.pos) !== true) {
        return 0
      }
      return Game.time - this.lastPosition.timestamp
    })()
    const options = moveToOptions(creep.pos, creep.room, this.target, staying)
    if (this.options.swampCost != null) {
      options.swampCost = this.options.swampCost
    }

    const result = creep.moveTo(this.target, options)
    if (creep.fatigue > 0 && this.lastPosition != null) {
      this.lastPosition.timestamp += 1
    } else {
      if (this.lastPosition == null || this.lastPosition.position.isEqualTo(creep.pos) !== true) {
        this.lastPosition = {
          position: creep.pos,
          timestamp: Game.time
        }
      }
    }

    switch (result) {
    case OK:
    case ERR_BUSY:
    case ERR_TIRED:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NO_PATH: {
      const noPathOptions = { ...options }
      noPathOptions.reusePath = 0
      const noPathResult = creep.moveTo(this.target, noPathOptions)
      switch (noPathResult) {
      case OK:
      case ERR_BUSY:
      case ERR_TIRED:
        return CreepApiWrapperProgress.InProgress(false)

      case ERR_NO_PATH: {
        return CreepApiWrapperProgress.Failed(new PathNotFoundProblem(creep.pos, this.target))
      }

      case ERR_NO_BODYPART:
        return CreepApiWrapperProgress.Failed(new CreepDamagedProblem(creep.memory.p, creep.room.name))

      case ERR_NOT_OWNER:
      case ERR_NOT_FOUND:
      case ERR_INVALID_TARGET:
      default:
        return CreepApiWrapperProgress.Failed(new UnexpectedCreepProblem(creep.memory.p, creep.room.name, apiWrapperType, result))
      }
    }

    case ERR_NO_BODYPART:
      return CreepApiWrapperProgress.Failed(new CreepDamagedProblem(creep.memory.p, creep.room.name))

    case ERR_NOT_OWNER:
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
    default:
      return CreepApiWrapperProgress.Failed(new UnexpectedCreepProblem(creep.memory.p, creep.room.name, apiWrapperType, result))
    }
  }
}
