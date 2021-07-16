import { CreepDamagedProblem } from "application/problem/creep/creep_damaged_problem"
import { PathNotFoundProblem } from "application/problem/creep/path_not_found_problem"
import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { V6Creep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "MoveToApiWrapper"

export interface MoveToApiWrapperOptions {
  reusePath?: number
  maxOps?: number
  maxRooms?: number
  range?: number
  swampCost?: number
}

export interface MoveToApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "MoveToApiWrapper"

  /** room position */
  p: RoomPositionState

  /** options */
  o: MoveToApiWrapperOptions
}

// TODO: 動いていないことを検出する
export class MoveToApiWrapper implements CreepApiWrapper {
  public readonly shortDescription: string

  private constructor(
    public readonly position: RoomPosition,
    public readonly options: MoveToApiWrapperOptions,
  ) {
    this.shortDescription = `${this.position.x},${this.position.y}`
  }

  public encode(): MoveToApiWrapperState {
    return {
      t: apiWrapperType,
      p: this.position.encode(),
      o: this.options,
    }
  }

  public static decode(state: MoveToApiWrapperState): MoveToApiWrapper {
    const position = decodeRoomPosition(state.p)
    return new MoveToApiWrapper(position, state.o)
  }

  public static create(position: RoomPosition, options: MoveToApiWrapperOptions): MoveToApiWrapper {
    return new MoveToApiWrapper(position, options)
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    const result = creep.moveTo(this.position, this.options)
    if (creep.pos.isEqualTo(this.position) === true) {
      return CreepApiWrapperProgress.Finished(false)
    }

    switch (result) {
    case OK:
    case ERR_BUSY:
    case ERR_TIRED:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NO_PATH:
      return CreepApiWrapperProgress.Failed(new PathNotFoundProblem(creep.pos, this.position))

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
