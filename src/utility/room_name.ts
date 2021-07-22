export type RoomName = string

export type RoomType = "normal" | "highway" | "highway_crossing" | "source_keeper" | "sector_center"

const RoomCoordinateDirection = ["NE", "NW", "SE", "SW"] as const
type RoomCoordinateDirection = typeof RoomCoordinateDirection[number]

export const isRoomName = (obj: string): obj is RoomName => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return RoomCoordinate.parse(obj) != null
}

export const isRoomCoordinateDirection = (obj: string): obj is RoomCoordinateDirection => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return RoomCoordinateDirection.includes(obj as any)
}

export class RoomCoordinate {
  public get roomType(): RoomType {
    return roomTypeFromCoordinate(this)
  }

  private constructor(
    public readonly roomName: RoomName,
    public readonly direction: RoomCoordinateDirection,
    public readonly x: number,
    public readonly y: number,
  ) {
  }

  // TODO: directionを超える場合を計算する
  public static create(direction: RoomCoordinateDirection, x: number, y: number): RoomCoordinate {
    const normalizedX = Math.max(x, 0)
    const normalizedY = Math.max(y, 0)
    const roomName = `${direction[1]}${normalizedX}${direction[0]}${normalizedY}`
    return new RoomCoordinate(roomName, direction, normalizedX, normalizedY)
  }

  public static parse(roomName: RoomName): RoomCoordinate | null {
    const parsed = /^([WE])([0-9]+)([NS])([0-9]+)$/.exec(roomName)
    if (parsed == null) {
      return null
    }

    const [, horizontalDirection, xString, verticalDirection, yString] = parsed
    if (xString == null || yString == null || horizontalDirection == null || verticalDirection == null) {
      return null
    }

    const x = parseInt(xString, 10)
    const y = parseInt(yString, 10)
    const direction = verticalDirection + horizontalDirection
    if (!isRoomCoordinateDirection(direction)) {
      return null
    }

    return new RoomCoordinate(roomName, direction, x, y)
  }
}

export function roomTypeOf(roomName: RoomName): RoomType | null {
  const coordinate = RoomCoordinate.parse(roomName)
  if (coordinate == null) {
    return null
  }
  return roomTypeFromCoordinate(coordinate)
}

function roomTypeFromCoordinate(roomCoordinate: RoomCoordinate): RoomType {
  const localX = roomCoordinate.x % 10
  const localY = roomCoordinate.y % 10
  const verticalHighway = localX === 0
  const horizontalHighway = localY === 0
  if (verticalHighway && horizontalHighway) {
    return "highway_crossing"
  }
  if (verticalHighway || horizontalHighway) {
    return "highway"
  }

  if (roomCoordinate.x % 5 === 0 && roomCoordinate.y % 5 === 0) {
    return "sector_center"
  }

  if (localX >= 4 && localX <= 6 && localY >= 4 && localY <= 6) {
    return "source_keeper"
  }
  return "normal"
}
