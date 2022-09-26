import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { describePosition } from "prototype/room_position"
import { TaskProgressType } from "v5_object_task/object_task"
import { roomLink } from "utility/log"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { defaultMoveToOptions } from "prototype/creep"
import type { Position } from "shared/utility/position"
import type { Timestamp } from "shared/utility/timestamp"

export interface StompTaskState extends CreepTaskState {
  /** destination position */
  readonly d: Position

  /** position in the previous tick */
  readonly p: Position | null

  /** previous tick */
  readonly tick: Timestamp | null

  readonly ignoreSwamp: boolean
}

/** MoveToTaskのrange=0と同一だが、停止回避処理が入っている */
export class StompTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    private readonly position: Position,
    private previousState: {
      readonly position: Position,
      readonly time: Timestamp,
    } | null,
    private readonly ignoreSwamp: boolean,
  ) {
    this.shortDescription = describePosition(position)
  }

  public encode(): StompTaskState {
    return {
      s: this.startTime,
      t: "StompTask",
      d: this.position,
      p: this.previousState?.position ?? null,
      tick: this.previousState?.time ?? null,
      ignoreSwamp: this.ignoreSwamp,
    }
  }

  public static decode(state: StompTaskState): StompTask {
    const previousState = ((): { position: Position, time: Timestamp } | null => {
      if (state.p == null || state.tick == null) {
        return null
      }
      return {
        position: state.p,
        time: state.tick,
      }
    })()
    return new StompTask(state.s, state.d, previousState, state.ignoreSwamp)
  }

  public static create(destinationPosition: RoomPosition, options?: { ignoreSwamp?: boolean }): StompTask {
    return new StompTask(Game.time, destinationPosition, null, options?.ignoreSwamp ?? false)
  }

  public run(creep: Creep): TaskProgressType {
    if (creep.pos.isEqualTo(this.position.x, this.position.y)) {
      return TaskProgressType.Finished
    }

    if (this.previousState != null && this.previousState.time === Game.time - 1) {
      if (creep.pos.isEqualTo(this.previousState.position.x, this.previousState.position.y) === true) {
        return TaskProgressType.Finished
      }
    }

    this.previousState = {
      position: { x: creep.pos.x, y: creep.pos.y },
      time: Game.time,
    }

    const result = creep.moveTo(this.position.x, this.position.y, this.moveToOpts())
    switch (result) {
    case OK:
      return TaskProgressType.InProgress

    case ERR_BUSY:
    case ERR_TIRED:
    case ERR_NO_BODYPART:
      return TaskProgressType.InProgress

    case ERR_NO_PATH:
      return TaskProgressType.InProgress  // Creepが動き続けており、時間経過で解決する可能性があるため

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    default:
      PrimitiveLogger.fatal(`creep.moveTo() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return TaskProgressType.Finished
    }
  }

  private moveToOpts(): MoveToOpts {
    const options = defaultMoveToOptions()
    if (this.ignoreSwamp === true) {
      options.ignoreRoads = true
      options.swampCost = 1
    }
    return options
  }
}
