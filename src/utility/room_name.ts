export type RoomName = string

export type RoomType = "normal" | "highway" | "highway_crossing" | "source_keeper" | "sector_center"

const RoomCoordinateDirection = ["NE", "NW", "SE", "SW"] as const
type RoomCoordinateDirection = typeof RoomCoordinateDirection[number]

export const isRoomName = (obj: string): obj is RoomName => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parseRoomCoordinate(obj) != null
}

export const isRoomCoordinateDirection = (obj: string): obj is RoomCoordinateDirection => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return RoomCoordinateDirection.includes(obj as any)
}

export interface RoomCoordinate {
  direction: RoomCoordinateDirection
  latitude: number
  longitude: number
}

export function parseRoomCoordinate(roomName: RoomName): RoomCoordinate | null {
  const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName)
  if (parsed == null || (parsed.length < 5)) {
    return null
  }

  const horizontalDirection = parsed[1]
  const longitude = parseInt(parsed[2], 10)
  const verticalDirection = parsed[3] as string
  const latitude = parseInt(parsed[4], 10)
  const direction = verticalDirection + horizontalDirection
  if (!isRoomCoordinateDirection(direction)) {
    return null
  }

  return {
    direction,
    latitude,
    longitude,
  }
}

export function roomTypeOf(roomName: RoomName): RoomType | null {
  const coordinate = parseRoomCoordinate(roomName)
  if (coordinate == null) {
    return null
  }

  const localLatitude = coordinate.latitude % 10
  const localLongitude = coordinate.longitude % 10
  const verticalHighway = localLongitude === 0
  const horizontalHighway = localLatitude === 0
  if (verticalHighway && horizontalHighway) {
    return "highway_crossing"
  }
  if (verticalHighway || horizontalHighway) {
    return "highway"
  }

  if (coordinate.latitude % 5 === 0 && coordinate.longitude % 5 === 0) {
    return "sector_center"
  }

  if (localLatitude >= 4 && localLatitude <= 6 && localLongitude >= 4 && localLongitude <= 6) {
    return "source_keeper"
  }
  return "normal"
}
