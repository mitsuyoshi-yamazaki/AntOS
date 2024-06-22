import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type MoveToState = {
  readonly t: TaskTypeEncodingMap["MoveTo"]
  readonly p: RoomPositionState
  readonly r?: number
}

export class MoveTo extends Task<MoveToState> {
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

  public run(creep: AnyV5Creep): TaskResult {
    if (creep.pos.isNearTo(this.position) === true) {
      return "finished"
    }

    const result = creep.moveTo(this.position)
    switch (result) {
    case OK:
      creep.executedActions.add("move")
      return "in progress"

    case ERR_BUSY:
    case ERR_TIRED:
      return "in progress"

    case ERR_NO_PATH:
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    case ERR_NOT_OWNER:
      return "failed"

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      return "failed"
    }
    }
  }
}
