import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomResources } from "room_resource/room_resources"
import { coloredText, roomLink } from "utility/log"
import { Result } from "utility/result"
import { isValidRoomName, RoomCoordinate, RoomName } from "../utility/room_name"

export type GameMapMemory = {
  interRoomPath: { [roomName: string]: { [destinationRoomName: string]: RoomName[] } }
}

const missingWaypointPairs: { from: RoomName, to: RoomName }[] = []
const cachedPairs: string[] = []

const MissingWaypoints = {
  add(fromRoomName: RoomName, toRoomName: RoomName): void {
    const identifier = `${fromRoomName}=>${toRoomName}`
    if (cachedPairs.includes(identifier) === true) {
      return
    }

    PrimitiveLogger.log(`${coloredText("[REQUEST]", "warn")} Requested missing waypoints: ${roomLink(fromRoomName)}=&gt${roomLink(toRoomName)}`)

    cachedPairs.push(identifier)
    missingWaypointPairs.push({
      from: fromRoomName,
      to: toRoomName,
    })
  },

  isMissing(fromRoomName: RoomName, toRoomName: RoomName): boolean {
    const identifier = `${fromRoomName}=>${toRoomName}`
    if (cachedPairs.includes(identifier) === true) {
      return true
    }
    return false
  },

  missingWaypoints(): { from: RoomName, to: RoomName }[] {
    return [...missingWaypointPairs]
  },

  clear(): void {
    if (missingWaypointPairs.length > 0) {
      missingWaypointPairs.splice(0, missingWaypointPairs.length)
    }
  },
}

export const GameMap = {
  beforeTick(): void {
  },

  afterTick(): void {
  },

  getWaypoints(roomName: RoomName, destinationRoomName: RoomName, options?: {ignoreMissingWaypoints?: boolean}): RoomName[] | null {
    if (roomName === destinationRoomName) {
      return []
    }
    const waypoints = getWaypoints(roomName, destinationRoomName)
    if (waypoints != null) {
      return waypoints
    }
    const returnTrip = getWaypoints(destinationRoomName, roomName)
    if (returnTrip != null) {
      returnTrip.reverse()
      return returnTrip
    }

    if (MissingWaypoints.isMissing(roomName, destinationRoomName) === true) {
      return null
    }

    const calculatedWaypoints = calculateWaypoints(roomName, destinationRoomName)
    if (calculatedWaypoints != null) {
      this.setWaypoints(roomName, destinationRoomName, calculatedWaypoints)
      return calculatedWaypoints
    }

    if (options?.ignoreMissingWaypoints !== true) {
      MissingWaypoints.add(roomName, destinationRoomName)
    }
    return null
  },

  setWaypoints(roomName: RoomName, destinationRoomName: RoomName, waypoints: RoomName[]): Result<void, { invalidRoomNames: RoomName[] }> {
    if (roomName === destinationRoomName) {
      return Result.Failed({invalidRoomNames: []})
    }
    const roomNames: RoomName[] = [
      roomName,
      destinationRoomName,
      ...waypoints,
    ]
    const invalidRoomNames = roomNames.filter(name => isValidRoomName(name) !== true)
    if (invalidRoomNames.length > 0) {
      return Result.Failed({
        invalidRoomNames
      })
    }

    const infoList = ((): { [destinationRoomName: string]: RoomName[] } => {
      const stored = Memory.gameMap.interRoomPath[roomName]
      if (stored != null) {
        return stored
      }
      const list: { [destinationRoomName: string]: RoomName[] } = {}
      Memory.gameMap.interRoomPath[roomName] = list
      return list
    })()
    infoList[destinationRoomName] = waypoints
    return Result.Succeeded(undefined)
  },

  hasWaypoints(roomName: RoomName, destinationRoomName: RoomName): boolean {
    return this.getWaypoints(roomName, destinationRoomName, {ignoreMissingWaypoints: true}) != null
  },

  /** waypointsを考慮したRoom間距離 */
  pathDistance(fromRoomName: RoomName, toRoomName: RoomName): number | null {
    return Game.map.getRoomLinearDistance(fromRoomName, toRoomName) // FixMe:
  },

  clearMissingWaypoints(): { from: RoomName, to: RoomName }[] {
    const missingWaypoints = MissingWaypoints.missingWaypoints()
    MissingWaypoints.clear()
    return missingWaypoints
  },

  calculateSafeRoute(fromRoomName: RoomName, toRoomName: RoomName): RoomName[] | null {
    return calculateSafeRoute(fromRoomName, toRoomName)
  },
}

function getWaypoints(roomName: RoomName, destinationRoomName: RoomName): RoomName[] | null {
  const infoList = Memory.gameMap.interRoomPath[roomName]
  if (infoList == null) {
    return null
  }
  const waypoints = infoList[destinationRoomName]
  if (waypoints == null) {
    return null
  }
  return [...waypoints]
}

function calculateWaypoints(roomName: RoomName, destinationRoomName: RoomName): RoomName[] | null {
  const adjacentWaypoints = adjacentRoomWaypoints(roomName, destinationRoomName)
  if (adjacentWaypoints != null) {
    return adjacentWaypoints
  }

  const straightWaypoints = straightRoomWaypoints(roomName, destinationRoomName)
  if (straightWaypoints != null) {
    return straightWaypoints
  }

  return null
}

function adjacentRoomWaypoints(roomName: RoomName, destinationRoomName: RoomName): RoomName[] | null {
  const adjacentRoomNames = Array.from(Object.values(Game.map.describeExits(roomName)))
  if (adjacentRoomNames.includes(destinationRoomName) === true) {
    return []
  }
  return null
}

function straightRoomWaypoints(roomName: RoomName, destinationRoomName: RoomName): RoomName[] | null {
  const coordinate = RoomCoordinate.parse(roomName)
  const destinationCoordinate = RoomCoordinate.parse(roomName)
  if (coordinate == null || destinationCoordinate == null) {
    return null
  }

  if (coordinate.isLinearTo(destinationRoomName) !== true) {
    return null
  }

  const route = Game.map.findRoute(roomName, destinationRoomName)
  if (route === ERR_NO_PATH) {
    return null
  }
  const linearDistance = Game.map.getRoomLinearDistance(roomName, destinationRoomName)
  if (route.length !== linearDistance) {
    return null
  }
  return []
}

const calculateSafeRoute = (fromRoomName: RoomName, toRoomName: RoomName): RoomName[] | null => {
  const normalCost = 1
  const obstacleCost = Infinity

  const routeCallback = (roomName: RoomName): number => {
    if (roomName === fromRoomName || roomName === toRoomName) {
      return normalCost
    }

    const roomInfo = RoomResources.getRoomInfo(roomName)
    if (roomInfo == null) {
      return normalCost
    }
    if (roomInfo.roomType !== "normal") {
      return normalCost
    }
    if (roomInfo.owner == null) {
      return normalCost
    }
    switch (roomInfo.owner.ownerType) {
    case "reserve":
      return normalCost
    case "claim":
      return obstacleCost
    }
  }

  const route = Game.map.findRoute(fromRoomName, toRoomName, { routeCallback })
  if (route === ERR_NO_PATH) {
    return null
  }
  return route.map(routePosition => routePosition.room)
}
