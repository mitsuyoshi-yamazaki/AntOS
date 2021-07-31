import { CreepDamagedProblem } from "application/problem/creep/creep_damaged_problem"
import { PathNotFoundProblem } from "application/problem/creep/path_not_found_problem"
import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions, moveToOptions, V6Creep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { Timestamp } from "utility/timestamp"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"
import { MoveToApiOptions } from "./move_to_api_options"

const apiWrapperType = "MoveToApiWrapper"
type Position = {
  position: RoomPosition,
  timestamp: Timestamp,
}
type PositionState = {
  position: RoomPositionState,
  timestamp: Timestamp,
}

interface MoveToApiWrapperOptions extends MoveToApiOptions {
  range: number
}

export interface MoveToApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "MoveToApiWrapper"

  /** room position */
  p: RoomPositionState

  /** options */
  o: MoveToApiWrapperOptions

  lastPosition: PositionState | null
}

export class MoveToApiWrapper implements CreepApiWrapper {
  public readonly shortDescription: string
  public readonly range: number

  private constructor(
    public readonly position: RoomPosition,
    public readonly options: MoveToApiWrapperOptions,
    private lastPosition: Position | null,
  ) {
    this.shortDescription = `${this.position.x},${this.position.y}`
    this.range = this.options.range
  }

  public encode(): MoveToApiWrapperState {
    return {
      t: apiWrapperType,
      p: this.position.encode(),
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

  public static decode(state: MoveToApiWrapperState): MoveToApiWrapper {
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
    return new MoveToApiWrapper(position, state.o, lastPosition)
  }

  public static create(position: RoomPosition, range: number, options?: MoveToApiOptions): MoveToApiWrapper {
    if (range <= 0) {
      PrimitiveLogger.programError(`${this.constructor.name} Unexpectedly ${range}range. Use MoveToPositionApiWrapper instead.`)
    }
    const moveToOptions = options ?? defaultMoveToOptions()
    return new MoveToApiWrapper(position, {...moveToOptions, range}, null)
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    if (creep.pos.isEqualTo(this.position) === true) {
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
    const options = moveToOptions(creep.pos, this.position, staying)
    options.range = this.options.range

    const result = creep.moveTo(this.position, options)
    if (this.lastPosition == null || this.lastPosition.position.isEqualTo(creep.pos) !== true) {
      this.lastPosition = {
        position: creep.pos,
        timestamp: Game.time
      }
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
