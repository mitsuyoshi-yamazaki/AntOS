import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type TrafficManagedMoveState = {
  readonly t: TaskTypeEncodingMap["TrafficManagedMove"]
  readonly p: RoomPositionState
  readonly r?: number
}

export type TrafficManagedMoveResult = void
export type TrafficManagedMoveError = void // TODO:

export class TrafficManagedMove extends Task<TrafficManagedMoveState, TrafficManagedMoveResult, TrafficManagedMoveError> {
  public readonly actionType = "move"

  private constructor(
    public readonly position: RoomPosition,
    public readonly range: number | undefined,
  ) {
    super()
  }

  public static decode(state: TrafficManagedMoveState): TrafficManagedMove {
    return new TrafficManagedMove(decodeRoomPosition(state.p), state.r)
  }

  public static create(position: RoomPosition, range?: number): TrafficManagedMove {
    return new TrafficManagedMove(position, range)
  }

  public encode(): TrafficManagedMoveState {
    return {
      t: "l",
      p: this.position.encode(),
      r: this.range,
    }
  }

  public run(creep: AnyV5Creep): TaskResult<TrafficManagedMoveResult, TrafficManagedMoveError> { // TODO: CreepはTrafficManagedでなければならない
    creep.say("Not I")
    return {
      case: "failed",
      taskType: "TrafficManagedMove",
      error: undefined,
    }
  }
}
