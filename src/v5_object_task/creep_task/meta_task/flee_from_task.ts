import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeRoomPosition, describePosition } from "prototype/room_position"
import { TaskProgressType } from "v5_object_task/object_task"
import { roomLink } from "utility/log"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import type { Position } from "shared/utility/position"

export interface FleeFromTaskState extends CreepTaskState {
  /** position creep flee from */
  d: Position

  /** range */
  r: number
}

export class FleeFromTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    private readonly position: Position,
    private readonly range: number,
  ) {
    this.shortDescription = describePosition(position)
  }

  public encode(): FleeFromTaskState {
    return {
      t: "FleeFromTask",
      d: this.position,
      r: this.range,
    }
  }

  public static decode(state: FleeFromTaskState): FleeFromTask {
    return new FleeFromTask(state.d, state.r)
  }

  public static create(position: Position, range: number): FleeFromTask {
    return new FleeFromTask({x: position.x, y: position.y}, range)
  }

  public run(creep: Creep): TaskProgressType {
    if (creep.pos.getRangeTo(this.position.x, this.position.y) >= this.range) {
      return TaskProgressType.Finished
    }

    // このタスクをよく使用するようなら経路をキャッシュする
    const roomPosition = decodeRoomPosition(this.position, creep.room.name)
    const path = PathFinder.search(creep.pos, { pos: roomPosition, range: this.range }, {
      flee: true,
      maxRooms: 1,
    })

    if (path.incomplete === true || path.path.length <= 0) {
      return TaskProgressType.Finished
    }

    const result = creep.moveByPath(path.path)
    switch (result) {
    case OK:
      return TaskProgressType.InProgress

    case ERR_BUSY:
    case ERR_TIRED:
    case ERR_NO_BODYPART:
      return TaskProgressType.InProgress

    case ERR_NOT_OWNER:
    case ERR_NOT_FOUND:
    case ERR_INVALID_ARGS:
      PrimitiveLogger.fatal(`creep.moveByPath() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return TaskProgressType.Finished
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      PrimitiveLogger.fatal(`creep.moveByPath() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return TaskProgressType.Finished
    }
    }
  }
}
