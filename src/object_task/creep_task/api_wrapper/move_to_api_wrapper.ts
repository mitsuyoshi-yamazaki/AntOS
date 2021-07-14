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

  public run(creep: Creep): CreepApiWrapperProgress {
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
    case ERR_NOT_OWNER:
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    default:
      return CreepApiWrapperProgress.Failed(apiWrapperType, creep.name, result)
    }
  }
}
