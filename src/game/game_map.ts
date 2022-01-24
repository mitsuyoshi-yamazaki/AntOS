import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText, roomLink } from "utility/log"
import { Result } from "utility/result"
import { isValidRoomName, RoomName } from "../utility/room_name"

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
    cachedPairs.push(identifier)
    missingWaypointPairs.push({
      from: fromRoomName,
      to: toRoomName,
    })
  },
}

export const GameMap = {
  beforeTick(): void {
  },

  afterTick(): void {
    if (missingWaypointPairs.length > 0) {
      const missingWaypoints = missingWaypointPairs.map(pair => `${roomLink(pair.from)}=>${roomLink(pair.to)}`).join(", ")
      PrimitiveLogger.notice(`${coloredText("[REQUEST]", "warn")} Requested missing waypoints: ${missingWaypoints}`)

      missingWaypointPairs.splice(0, missingWaypointPairs.length)
    }
  },

  getWaypoints(roomName: RoomName, destinationRoomName: RoomName): RoomName[] | null {
    const waypoints = getWaypoints(roomName, destinationRoomName)
    if (waypoints != null) {
      return waypoints
    }
    const returnTrip = getWaypoints(destinationRoomName, roomName)
    if (returnTrip != null) {
      returnTrip.reverse()
      return returnTrip
    }
    const adjacentRoomNames = Array.from(Object.values(Game.map.describeExits(roomName)))
    if (adjacentRoomNames.includes(destinationRoomName) === true) {
      this.setWaypoints(roomName, destinationRoomName, [])
      return []
    }
    MissingWaypoints.add(roomName, destinationRoomName)
    return null
  },

  setWaypoints(roomName: RoomName, destinationRoomName: RoomName, waypoints: RoomName[]): Result<void, {invalidRoomNames: RoomName[]}> {
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

  /** waypointsを考慮したRoom間距離 */
  pathDistance(fromRoomName: RoomName, toRoomName: RoomName): number | null {
    return Game.map.getRoomLinearDistance(fromRoomName, toRoomName) // FixMe:
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
