import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { TaskProgressType } from "v5_object_task/object_task"
import { roomLink } from "utility/log"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { interRoomMoveToOptions } from "prototype/creep"

export interface MoveToTaskState extends CreepTaskState {
  /** destination position */
  d: RoomPositionState

  /** range */
  r: number

  ignoreSwamp: boolean
}

export class MoveToTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly destinationPosition: RoomPosition,
    public readonly range: number,
    public readonly ignoreSwamp: boolean,
  ) {
    this.shortDescription = `${this.destinationPosition.x},${this.destinationPosition.y}`
  }

  public encode(): MoveToTaskState {
    return {
      s: this.startTime,
      t: "MoveToTask",
      d: this.destinationPosition.encode(),
      r: this.range,
      ignoreSwamp: this.ignoreSwamp,
    }
  }

  public static decode(state: MoveToTaskState): MoveToTask {
    return new MoveToTask(state.s, decodeRoomPosition(state.d), state.r, state.ignoreSwamp ?? false)
  }

  public static create(destinationPosition: RoomPosition, range: number, options?: { ignoreSwamp: boolean}): MoveToTask {
    return new MoveToTask(Game.time, destinationPosition, range, options?.ignoreSwamp ?? false)
  }

  public run(creep: Creep): TaskProgressType {
    if (creep.pos.getRangeTo(this.destinationPosition) <= this.range) {
      return TaskProgressType.Finished
    }

    const result = creep.moveTo(this.destinationPosition, this.moveToOpts())
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
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
      PrimitiveLogger.fatal(`creep.moveTo() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return TaskProgressType.Finished
    }
  }

  private moveToOpts(): MoveToOpts {
    const options = interRoomMoveToOptions()
    if (this.ignoreSwamp === true) {
      options.ignoreRoads = true
      options.swampCost = 1
    }
    return options
  }
}
