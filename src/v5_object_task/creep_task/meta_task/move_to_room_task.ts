import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions } from "prototype/creep"
import { RoomName, roomTypeOf } from "utility/room_name"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { TaskProgressType } from "v5_object_task/object_task"
import { roomLink } from "utility/log"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { SourceKeeper } from "game/source_keeper"
import { OBSTACLE_COST } from "utility/constants"

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

    const reusePath = 20
    const noPathFindingOptions: MoveToOpts = {
      noPathFinding: true,
      reusePath,
    }

    const moveToOptions = ((): MoveToOpts => {
      const options: MoveToOpts = { ...defaultMoveToOptions }
      options.reusePath = reusePath
      if (roomTypeOf(creep.room.name) !== "source_keeper") {
        return options
      }
      creep.say("SK room")
      // 保存されたパスがあれば計算はスキップする

      const roomPositionFilteringOptions: RoomPositionFilteringOptions = {
        excludeItself: false,
        excludeTerrainWalls: false,
        excludeStructures: false,
        excludeWalkableStructures: false,
      }

      options.maxOps = 2000
      const sourceKeepers = creep.room.find(FIND_HOSTILE_CREEPS)
        .filter(creep => creep.owner.username === SourceKeeper.username)
      const positionsToAvoid = sourceKeepers
        .flatMap(creep => creep.pos.positionsInRange(4, roomPositionFilteringOptions))

      options.costCallback = (roomName: RoomName, costMatrix: CostMatrix): CostMatrix | void => {
        if (roomName !== creep.room.name) {
          return
        }
        positionsToAvoid.forEach(position => {
          creep.room.visual.text("x", position.x, position.y, { align: "center", color: "#ff0000" })
          costMatrix.set(position.x, position.y, OBSTACLE_COST)
        })
        return costMatrix
      }
      return options
    })

    if (this.exitPosition != null) {
      if (this.exitPosition.roomName === creep.room.name) {
        if (creep.moveTo(this.exitPosition, noPathFindingOptions) === ERR_NOT_FOUND) {
          creep.moveTo(this.exitPosition, moveToOptions())
        }
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
    if (creep.moveTo(exitPosition, noPathFindingOptions) === ERR_NOT_FOUND) {
      creep.moveTo(exitPosition, moveToOptions())
    }

    return TaskProgressType.InProgress
  }
}
