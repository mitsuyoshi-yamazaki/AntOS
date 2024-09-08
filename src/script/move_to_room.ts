import { SourceKeeper } from "game/source_keeper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions } from "prototype/creep"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { GameConstants, OBSTACLE_COST } from "utility/constants"
import { roomLink } from "utility/log"
import type { RoomName } from "shared/utility/room_name_types"
import { roomTypeOf } from "utility/room_coordinate"

export function moveToRoom(creep: AnyCreep, targetRoomName: RoomName, waypoints: RoomName[], sourceKeeperRange?: number): void {
  const creepRoom = creep.room
  if (creepRoom == null) {
    PrimitiveLogger.fatal(`Power creep ${creep.name} is not deployed`)
    return
  }

  if (creep.pos.x === 0) {
    if (creep.move(RIGHT) === OK) {
      return
    }
  } else if (creep.pos.x === 49) {
    if (creep.move(LEFT) === OK) {
      return
    }
  } else if (creep.pos.y === 0) {
    if (creep.move(BOTTOM) === OK) {
      return
    }
  } else if (creep.pos.y === 49) {
    if (creep.move(TOP) === OK) {
      return
    }
  }
  // const directionIndex = Game.time % 3

  // if(creep.pos.x === 0) {
  //   if (creep.move([RIGHT, TOP_RIGHT, BOTTOM_RIGHT][directionIndex] ?? RIGHT) === OK) {
  //     return
  //   }
  // } else if (creep.pos.x === 49) {
  //   if (creep.move([LEFT, TOP_LEFT, BOTTOM_LEFT][directionIndex] ?? LEFT) === OK) {
  //     return
  //   }
  // } else if (creep.pos.y === 0) {
  //   if (creep.move([BOTTOM, BOTTOM_LEFT, BOTTOM_RIGHT][directionIndex] ?? BOTTOM) === OK) {
  //     return
  //   }
  // } else if (creep.pos.y === 49) {
  //   if (creep.move([TOP, TOP_LEFT, TOP_RIGHT][directionIndex] ?? TOP) === OK) {
  //     return
  //   }
  // }

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

  const portals = creepRoom.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL } }) as StructurePortal[]

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
    const exit = creepRoom.findExitTo(destinationRoomName)
    if (exit === ERR_NO_PATH) {
      creep.say("no exit")
      PrimitiveLogger.fatal(`creep findExitTo() returns ERR_NO_PATH, from ${roomLink(creepRoom.name)} to ${roomLink(destinationRoomName)}`)
      return "no exit"
    } else if (exit === ERR_INVALID_ARGS) {
      PrimitiveLogger.fatal(`Room.findExitTo() returns ERR_INVALID_ARGS (${exit}), room ${roomLink(creepRoom.name)} to ${roomLink(destinationRoomName)}`)
      return "invalid"
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

    if (exitFlag != null) {
      return exitFlag.pos
    }
    return creep.pos.findClosestByPath(exit) ?? "no path3"
  })()

  if (typeof exitPosition === "string") {
    creep.say(exitPosition)
    // if (creep.room.controller != null) {
    //   creep.moveTo(creep.room.controller, defaultMoveToOptions())
    // } else {
    //   creep.moveTo(25, 25, defaultMoveToOptions())
    // }
    return // TODO: よくはまるようなら代替コードを書く
  }

  const positionsToAvoid: RoomPosition[] = portals.map(portal => portal.pos)
  avoidSourceKeeper(creep, creepRoom, exitPosition, { sourceKeeperRange, positionsToAvoid})
}

export function avoidSourceKeeper(creep: AnyCreep, creepRoom: Room, destinationPosition: RoomPosition, options?: { sourceKeeperRange?: number, positionsToAvoid?: RoomPosition[], moveToOps?: MoveToOpts}): void {
  const reusePath = 20
  const noPathFindingOptions = ((): MoveToOpts => {
    if (options?.moveToOps != null) {
      const opts: MoveToOpts = { ...options.moveToOps }
      if (opts.reusePath == null) {
        opts.reusePath = reusePath
      }
      return opts
    }
    return {
      noPathFinding: true,
      reusePath,
    }
  })()

  const moveToOptions = ((): MoveToOpts => {
    const moveToOps: MoveToOpts = ((): MoveToOpts => {
      if (options?.moveToOps != null) {
        const opts: MoveToOpts = { ...options.moveToOps }
        if (opts.reusePath == null) {
          opts.reusePath = reusePath
        }
        return opts
      }
      const opts = defaultMoveToOptions()
      opts.reusePath = reusePath
      return opts
    })()

    const positionsToAvoid: RoomPosition[] = []
    if (options?.positionsToAvoid != null) {
      positionsToAvoid.push(...(options?.positionsToAvoid ?? []))
    }

    switch (roomTypeOf(creepRoom.name)) {
    case "normal":
    case "highway":
      return moveToOps

    case "source_keeper": {
      creep.say("SK room")
      // 保存されたパスがあれば計算はスキップする

      const roomPositionFilteringOptions: RoomPositionFilteringOptions = {
        excludeItself: false,
        excludeTerrainWalls: false,
        excludeStructures: false,
        excludeWalkableStructures: false,
      }

      moveToOps.maxOps = 2000
      const sourceKeeperObstacleRange = options?.sourceKeeperRange ?? 4
      const sourceKeeperPositions = creepRoom.find(FIND_HOSTILE_CREEPS)
        .filter(creep => creep.owner.username === SourceKeeper.username)
        .flatMap(creep => creep.pos.positionsInRange(sourceKeeperObstacleRange, roomPositionFilteringOptions))
      positionsToAvoid.push(...sourceKeeperPositions)
      break
    }

    case "highway_crossing":
    case "sector_center":
      break
    }

    if (positionsToAvoid.length <= 0) {
      return moveToOps
    }
    moveToOps.costCallback = (roomName: RoomName, costMatrix: CostMatrix): CostMatrix | void => {
      if (roomName !== creepRoom.name) {
        return
      }
      positionsToAvoid.forEach(position => {
        // creep.room.visual.text("x", position.x, position.y, { align: "center", color: "#ff0000" })
        costMatrix.set(position.x, position.y, OBSTACLE_COST)
      })
      return costMatrix
    }
    return moveToOps
  })

  if (creep.moveTo(destinationPosition, noPathFindingOptions) === ERR_NOT_FOUND) {
    creep.moveTo(destinationPosition, moveToOptions())
  }
}
