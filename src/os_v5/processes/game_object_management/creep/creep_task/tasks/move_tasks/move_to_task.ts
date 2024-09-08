import { AnyV5Creep, isSpawnedV5Creep } from "os_v5/utility/game_object/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type MoveToState = {
  readonly t: TaskTypeEncodingMap["MoveTo"]
  readonly p: RoomPositionState
  readonly r?: number
}

type Range = number
export type MoveToResult = Range
export type MoveToError = Exclude<ReturnType<Creep["moveTo"]>, OK>


export class MoveTo extends Task<MoveToState, MoveToResult, MoveToError> {
  public readonly actionType = "move"

  private constructor(
    public readonly position: RoomPosition,
    public readonly range: number | undefined,
  ) {
    super()
  }

  public static decode(state: MoveToState): MoveTo {
    return new MoveTo(decodeRoomPosition(state.p), state.r)
  }

  public static create(position: RoomPosition, range?: number): MoveTo {
    return new MoveTo(position, range)
  }

  public encode(): MoveToState {
    return {
      t: "a",
      p: this.position.encode(),
      r: this.range,
    }
  }

  public run(creep: AnyV5Creep): TaskResult<MoveToResult, MoveToError> {
    if (!isSpawnedV5Creep(creep)) {
      return {
        case: "in_progress",
      }
    }
    if (creep.fatigue > 0) {
      return {
        case: "in_progress",
      }
    }

    const rangeToTarget = creep.pos.getRangeTo(this.position)
    if (rangeToTarget <= (this.range ?? 1)) {
      return {
        case: "finished",
        taskType: "MoveTo",
        result: rangeToTarget,
      }
    }

    const result = creep.moveTo(this.position)

    switch (result) {
    case OK:
      creep.executedActions.add(this.actionType)
      return {
        case: "in_progress",
      }

    case ERR_BUSY:
    case ERR_TIRED:
      return {
        case: "in_progress",
      }

    case ERR_NO_PATH:
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    case ERR_NOT_OWNER:
      return {
        case: "failed",
        taskType: "MoveTo",
        error: result,
      }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      return {
        case: "failed",
        taskType: "MoveTo",
        error: result,
      }
    }
    }
  }
}
