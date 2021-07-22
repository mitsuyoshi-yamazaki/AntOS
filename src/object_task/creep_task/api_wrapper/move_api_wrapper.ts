import { CreepDamagedProblem } from "application/problem/creep/creep_damaged_problem"
import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { V6Creep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { directionDescription } from "utility/constants"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "MoveApiWrapper"

/**
 * - 動作確認まで含めるとFinishするまで2tickかかる
 */
export interface MoveApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "MoveApiWrapper"

  /** original position */
  p: RoomPositionState

  /** direction */
  d: DirectionConstant
}

export class MoveApiWrapper implements CreepApiWrapper {
  public readonly shortDescription: string

  private constructor(
    public readonly originalPosition: RoomPosition,
    public readonly direction: DirectionConstant,
  ) {
    this.shortDescription = directionDescription(this.direction)
  }

  public encode(): MoveApiWrapperState {
    return {
      t: apiWrapperType,
      p: this.originalPosition.encode(),
      d: this.direction,
    }
  }

  public static decode(state: MoveApiWrapperState): MoveApiWrapper {
    const position = decodeRoomPosition(state.p)
    return new MoveApiWrapper(position, state.d)
  }

  public static create(originalPosition: RoomPosition, direction: DirectionConstant): MoveApiWrapper {
    return new MoveApiWrapper(originalPosition, direction)
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    if (creep.pos.isEqualTo(this.originalPosition) === true) {
      return CreepApiWrapperProgress.Finished(false)
    }
    const result = creep.move(this.direction)

    switch (result) {
    case OK:
    case ERR_BUSY:
    case ERR_TIRED:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NO_BODYPART:
      return CreepApiWrapperProgress.Failed(new CreepDamagedProblem(creep.memory.p, creep.room.name))

    case ERR_NOT_OWNER:
    default:
      return CreepApiWrapperProgress.Failed(new UnexpectedCreepProblem(creep.memory.p, creep.room.name, apiWrapperType, result))
    }
  }
}
