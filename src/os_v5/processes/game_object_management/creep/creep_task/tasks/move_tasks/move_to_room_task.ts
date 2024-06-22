import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { RoomName } from "shared/utility/room_name_types"
import { GameConstants } from "utility/constants"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type MoveToRoomState = {
  readonly t: TaskTypeEncodingMap["MoveToRoom"]
  readonly d: RoomName
  readonly w: RoomName[]
}

export class MoveToRoom extends Task<MoveToRoomState> {
  public readonly actionType = "move"
  private exitPosition: RoomPosition | null = null

  private constructor(
    public readonly destinationRoomName: RoomName,
    public readonly waypoints: RoomName[],
  ) {
    super()
  }

  public static decode(state: MoveToRoomState): MoveToRoom {
    return new MoveToRoom(state.d, state.w)
  }

  public static create(destinationRoomName: RoomName, waypoints: RoomName[]): MoveToRoom {
    return new MoveToRoom(destinationRoomName, waypoints)
  }

  public encode(): MoveToRoomState {
    return {
      t: "f",
      d: this.destinationRoomName,
      w: this.waypoints,
    }
  }

  public run(creep: AnyV5Creep): TaskResult {
    if (creep.room.name === this.destinationRoomName) {
      return "finished"
    }

    const waypointIndex = this.waypoints.indexOf(creep.room.name)
    if (waypointIndex >= 0) {
      this.waypoints.splice(0, waypointIndex + 1)
    }

    const destinationRoomName = this.waypoints[0] ?? this.destinationRoomName

    if (this.exitPosition != null) {
      if (this.exitPosition.roomName === creep.room.name) {
        return this.moveCreep(creep, this.exitPosition)
      }
      this.exitPosition = null
    }

    const portals = creep.room.find<StructurePortal>(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL } })
    const exitPortal = portals.find(portal => {
      if (!(portal.destination instanceof RoomPosition)) {
        return false
      }
      if (portal.destination.roomName !== destinationRoomName) {
        return false
      }
      return true
    })

    const exitPosition = ((): RoomPosition | string => {
      if (exitPortal != null) {
        return exitPortal.pos
      }
      const exit = creep.room.findExitTo(destinationRoomName)
      if (exit === ERR_NO_PATH) {
        return "no exit"
      } else if (exit === ERR_INVALID_ARGS) {
        return "invalid"
      }

      const exitFlag = creep.room.find(FIND_FLAGS).find(flag => {
        switch (exit) {
        case FIND_EXIT_TOP:
          if (flag.pos.y === GameConstants.room.edgePosition.min) {
            return true
          }
          break
        case FIND_EXIT_BOTTOM:
          if (flag.pos.y === GameConstants.room.edgePosition.max) {
            return true
          }
          break
        case FIND_EXIT_LEFT:
          if (flag.pos.x === GameConstants.room.edgePosition.min) {
            return true
          }
          break
        case FIND_EXIT_RIGHT:
          if (flag.pos.x === GameConstants.room.edgePosition.max) {
            return true
          }
          break
        default:
          break
        }
        return false
      })

      if (exitFlag != null) {
        return exitFlag.pos
      }
      return creep.pos.findClosestByPath(exit) ?? "no path"
    })()

    if (typeof exitPosition === "string") {
      creep.say(exitPosition)
      return "failed"
    }

    this.exitPosition = exitPosition
    return this.moveCreep(creep, this.exitPosition)
  }

  private moveCreep(creep: AnyV5Creep, position: RoomPosition): TaskResult {
    const moveToOptions: MoveToOpts = {
      reusePath: 8,
      serializeMemory: true,
    }
    const result = creep.moveTo(position, moveToOptions)

    switch (result) {
    case OK:
      creep.executedActions.add("move")
      return "in progress"

    case ERR_BUSY:
    case ERR_TIRED:
      return "in progress"

    case ERR_NO_PATH:
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    case ERR_NOT_OWNER:
      return "failed"

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      return "failed"
    }
    }
  }
}
