import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText, roomLink } from "utility/log"
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
    if (returnTrip == null) {
      return null
    }
    returnTrip.reverse()
    return returnTrip
  },

  setWaypoints(roomName: RoomName, destinationRoomName: RoomName, waypoints: RoomName[]): void {
    const roomNames: RoomName[] = [
      roomName,
      destinationRoomName,
      ...waypoints,
    ]
    for (const name of roomNames) {
      if (isValidRoomName(name) !== true) {
        PrimitiveLogger.programError(`GameMap.setWaypoints() ${name} is not valid roomname`)
        return
      }
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
  },
}

function getWaypoints(roomName: RoomName, destinationRoomName: RoomName): RoomName[] | null {
  const infoList = Memory.gameMap.interRoomPath[roomName]
  if (infoList == null) {
    MissingWaypoints.add(roomName, destinationRoomName)
    return null
  }
  const waypoints = infoList[destinationRoomName]
  if (waypoints == null) {
    return null
  }
  return [...waypoints]
}
