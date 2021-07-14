import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions } from "prototype/creep"
import { RoomName } from "utility/room_name"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { TaskProgressType } from "v5_object_task/object_task"
import { roomLink } from "utility/log"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface MoveToRoomTaskState extends CreepTaskState {
  /** destination room name */
  d: RoomName

  /** waypoints */
  w: RoomName[]

  /** exit position */
  e: RoomPositionState | null
}

export class MoveToRoomTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly destinationRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private exitPosition: RoomPosition | null
  ) {
    this.shortDescription = this.destinationRoomName
  }

  public encode(): MoveToRoomTaskState {
    return {
      s: this.startTime,
      t: "MoveToRoomTask",
      d: this.destinationRoomName,
      w: this.waypoints,
      e: this.exitPosition?.encode() ?? null,
    }
  }

  public static decode(state: MoveToRoomTaskState): MoveToRoomTask {
    const exitPosition = state.e != null ? decodeRoomPosition(state.e) : null
    return new MoveToRoomTask(state.s, state.d, state.w, exitPosition)
  }

  public static create(destinationRoomName: RoomName, waypoints: RoomName[]): MoveToRoomTask {
    return new MoveToRoomTask(Game.time, destinationRoomName, waypoints, null)
  }

  public run(creep: Creep): TaskProgressType {
    const directionIndex = (Game.time + this.startTime) % 3

    if (creep.pos.x === 0) {
      if (creep.move([RIGHT, TOP_RIGHT, BOTTOM_RIGHT][directionIndex]) === OK) {
        return TaskProgressType.InProgress
      }
    } else if (creep.pos.x === 49) {
      if (creep.move([LEFT, TOP_LEFT, BOTTOM_LEFT][directionIndex]) === OK) {
        return TaskProgressType.InProgress
      }
    } else if (creep.pos.y === 0) {
      if (creep.move([BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT][directionIndex]) === OK) {
        return TaskProgressType.InProgress
      }
    } else if (creep.pos.y === 49) {
      if (creep.move([TOP, TOP_LEFT, TOP_RIGHT][directionIndex]) === OK) {
        return TaskProgressType.InProgress
      }
    }

    if (creep.room.name === this.destinationRoomName) {
      return TaskProgressType.Finished
    }

    const destinationRoomName = ((): RoomName => {
      const nextWaypoint = this.waypoints[0]
      if (nextWaypoint == null) {
        return this.destinationRoomName
      }
      if (nextWaypoint === creep.room.name) {
        this.waypoints.shift()
        return this.waypoints[0] ?? this.destinationRoomName
      }
      return nextWaypoint
    })()

    if (this.exitPosition != null) {
      if (this.exitPosition.roomName === creep.room.name) {
        creep.moveTo(this.exitPosition, defaultMoveToOptions)
        return TaskProgressType.InProgress
      }
      this.exitPosition = null
    }

    const exit = creep.room.findExitTo(destinationRoomName)
    if (exit === ERR_NO_PATH) {
      creep.say("no exit")
      return TaskProgressType.InProgress  // TODO: よくはまるようなら代替コードを書く
    } else if (exit === ERR_INVALID_ARGS) {
      creep.say("invalid")
      PrimitiveLogger.fatal(`Room.findExitTo() returns ERR_INVALID_ARGS (${exit}), room ${roomLink(creep.room.name)} to ${roomLink(destinationRoomName)}`)
      return TaskProgressType.InProgress  // 代替できる行動がなく、状況が変わるかもしれないので
    }

    const exitPosition = creep.pos.findClosestByPath(exit)
    if (exitPosition == null) {
      creep.say("no path")
      if (creep.room.controller != null) {
        creep.moveTo(creep.room.controller, defaultMoveToOptions)
      } else {
        creep.moveTo(25, 25, defaultMoveToOptions)
      }
      return TaskProgressType.InProgress  // TODO: よくはまるようなら代替コードを書く
    }

    this.exitPosition = exitPosition
    creep.moveTo(exitPosition, defaultMoveToOptions) // TODO: エラー処理
    return TaskProgressType.InProgress
  }
}
