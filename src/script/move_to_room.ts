import { SourceKeeper } from "game/source_keeper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions } from "prototype/creep"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { GameConstants, OBSTACLE_COST } from "utility/constants"
import { roomLink } from "utility/log"
import { RoomName, roomTypeOf } from "utility/room_name"

export function moveToRoom(creep: AnyCreep, targetRoomName: RoomName, waypoints: RoomName[]): void {
  const creepRoom = creep.room
  if (creepRoom == null) {
    PrimitiveLogger.fatal(`Power creep ${creep.name} is not deployed`)
    return
  }

  const directionIndex = Game.time % 3

  if(creep.pos.x === 0) {
    if (creep.move([RIGHT, TOP_RIGHT, BOTTOM_RIGHT][directionIndex] ?? RIGHT) === OK) {
      return
    }
  } else if (creep.pos.x === 49) {
    if (creep.move([LEFT, TOP_LEFT, BOTTOM_LEFT][directionIndex] ?? LEFT) === OK) {
      return
    }
  } else if (creep.pos.y === 0) {
    if (creep.move([BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT][directionIndex] ?? BOTTOM) === OK) {
      return
    }
  } else if (creep.pos.y === 49) {
    if (creep.move([TOP, TOP_LEFT, TOP_RIGHT][directionIndex] ?? TOP) === OK) {
      return
    }
  }

  if (creepRoom.name === targetRoomName) {
    return
  }

  const destinationRoomName = ((): RoomName => {
    const nextWaypoint = waypoints[0]
    if (nextWaypoint == null) {
      return targetRoomName
    }
    if (nextWaypoint === creepRoom.name) {
      waypoints.shift()
      return waypoints[0] ?? targetRoomName
    }
    return nextWaypoint
  })()

  const reusePath = 20
  const noPathFindingOptions: MoveToOpts = {
    noPathFinding: true,
    reusePath,
  }

  const moveToOptions = ((): MoveToOpts => {
    const options: MoveToOpts = defaultMoveToOptions()
    options.reusePath = reusePath
    if (roomTypeOf(creepRoom.name) !== "source_keeper") {
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
    const sourceKeepers = creepRoom.find(FIND_HOSTILE_CREEPS)
      .filter(creep => creep.owner.username === SourceKeeper.username)
    const positionsToAvoid = sourceKeepers
      .flatMap(creep => creep.pos.positionsInRange(4, roomPositionFilteringOptions))

    options.costCallback = (roomName: RoomName, costMatrix: CostMatrix): CostMatrix | void => {
      if (roomName !== creepRoom.name) {
        return
      }
      positionsToAvoid.forEach(position => {
      // creepRoom.visual.text("x", position.x, position.y, { align: "center", color: "#ff0000" })
        costMatrix.set(position.x, position.y, OBSTACLE_COST)
      })
      return costMatrix
    }
    return options
  })

  const exit = creepRoom.findExitTo(destinationRoomName)
  if (exit === ERR_NO_PATH) {
    creep.say("no exit")
    return
  } else if (exit === ERR_INVALID_ARGS) {
    creep.say("invalid")
    PrimitiveLogger.fatal(`Room.findExitTo() returns ERR_INVALID_ARGS (${exit}), room ${roomLink(creepRoom.name)} to ${roomLink(destinationRoomName)}`)
    return
  }

  const exitFlag = creepRoom.find(FIND_FLAGS).find(flag => {
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

  const exitPosition = exitFlag?.pos ?? creep.pos.findClosestByPath(exit)
  if (exitPosition == null) {
    creep.say("no path")
    if (creepRoom.controller != null) {
      creep.moveTo(creepRoom.controller, defaultMoveToOptions())
    } else {
      creep.moveTo(25, 25, defaultMoveToOptions())
    }
    return
  }

  if (creep.moveTo(exitPosition, noPathFindingOptions) === ERR_NOT_FOUND) {
    creep.moveTo(exitPosition, moveToOptions())
  }
}
