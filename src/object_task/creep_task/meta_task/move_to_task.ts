import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { TaskProgressType } from "object_task/object_task"
import { roomLink } from "utility/log"
import { CreepTask, CreepTaskState } from "../creep_task"

export interface MoveToTaskState extends CreepTaskState {
  /** destination position */
  d: RoomPositionState

  /** range */
  r: number
}

export class MoveToTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly destinationPosition: RoomPosition,
    public readonly range: number,
  ) {
    this.shortDescription = `${this.destinationPosition.x},${this.destinationPosition.y}`
  }

  public encode(): MoveToTaskState {
    return {
      s: this.startTime,
      t: "MoveToTask",
      d: this.destinationPosition.encode(),
      r: this.range,
    }
  }

  public static decode(state: MoveToTaskState): MoveToTask {
    return new MoveToTask(state.s, decodeRoomPosition(state.d), state.r)
  }

  public static create(destinationPosition: RoomPosition, range: number): MoveToTask {
    return new MoveToTask(Game.time, destinationPosition, range)
  }

  public run(creep: Creep): TaskProgressType {
    if (creep.pos.getRangeTo(this.destinationPosition) <= this.range) {
      return TaskProgressType.Finished
    }

    const result = creep.moveTo(this.destinationPosition, {reusePath: 1})
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
}
