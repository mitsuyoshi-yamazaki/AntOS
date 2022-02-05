export type RoomName = string

export type RoomTypeNormal = "normal"
export type RoomTypeHighway = "highway"
export type RoomTypeHighwayCrossing = "highway_crossing"
export type RoomTypeSourceKeeper = "source_keeper"
export type RoomTypeSectorCenter = "sector_center"
export type RoomType = RoomTypeNormal | RoomTypeHighway | RoomTypeHighwayCrossing | RoomTypeSourceKeeper | RoomTypeSectorCenter

const RoomCoordinateDirection = ["NE", "NW", "SE", "SW"] as const
type RoomCoordinateDirection = typeof RoomCoordinateDirection[number]

export const isValidRoomName = (roomName: RoomName): boolean => {
  switch (Game.map.getRoomStatus(roomName).status ) {
  case "normal":
  case "novice":
  case "respawn":
    return true
  case "closed":
  default:  // フォーマットが悪いとundefinedが返る
    return false
  }
}

export const isRoomName = (obj: string): obj is RoomName => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return RoomCoordinate.parse(obj) != null
}

export const isRoomCoordinateDirection = (obj: string): obj is RoomCoordinateDirection => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return RoomCoordinateDirection.includes(obj as any)
}

export const isHighwayRoom = (roomType: RoomType): boolean => {
  switch (roomType) {
  case "highway":
  case "highway_crossing":
    return true
  case "normal":
  case "source_keeper":
  case "sector_center":
    return false
  }
}

export class RoomCoordinate {
  public get roomType(): RoomType {
    return roomTypeFromCoordinate(this)
  }

  public get xCoordinate(): string {
    return `${xDirection(this.direction)}${this.x}`
  }

  public get yCoordinate(): string {
    return `${yDirection(this.direction)}${this.y}`
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

  public neighbourRoom(direction: TOP | BOTTOM | LEFT | RIGHT): RoomName {
    switch (direction) {
    case TOP:
      return this.topNeighbourRoom()
    case BOTTOM:
      return this.bottomNeighbourRoom()
    case RIGHT:
      return this.rightNeighbourRoom()
    case LEFT:
      return this.leftNeighbourRoom()
    }
  }

  private topNeighbourRoom(): RoomName {
    switch (this.direction) {
    case "NE":
    case "NW":
      return RoomCoordinate.create(this.direction, this.x, this.y + 1).roomName

    case "SE":
      if (this.y > 0) {
        return RoomCoordinate.create(this.direction, this.x, this.y - 1).roomName
      }
      return RoomCoordinate.create("NE", this.x, 0).roomName

    case "SW":
      if (this.y > 0) {
        return RoomCoordinate.create(this.direction, this.x, this.y - 1).roomName
      }
      return RoomCoordinate.create("NW", this.x, 0).roomName
    }
  }

  private bottomNeighbourRoom(): RoomName {
    switch (this.direction) {
    case "NE":
      if (this.y > 0) {
        return RoomCoordinate.create(this.direction, this.x, this.y - 1).roomName
      }
      return RoomCoordinate.create("SE", this.x, 0).roomName

    case "NW":
      if (this.y > 0) {
        return RoomCoordinate.create(this.direction, this.x, this.y - 1).roomName
      }
      return RoomCoordinate.create("SW", this.x, 0).roomName

    case "SE":
    case "SW":
      return RoomCoordinate.create(this.direction, this.x, this.y + 1).roomName
    }
  }

  private leftNeighbourRoom(): RoomName {
    switch (this.direction) {
    case "NE":
      if (this.x > 0) {
        return RoomCoordinate.create(this.direction, this.x - 1, this.y).roomName
      }
      return RoomCoordinate.create("NW", 0, this.y).roomName

    case "SE":
      if (this.x > 0) {
        return RoomCoordinate.create(this.direction, this.x - 1, this.y).roomName
      }
      return RoomCoordinate.create("SW", 0, this.y).roomName

    case "NW":
    case "SW":
      return RoomCoordinate.create(this.direction, this.x + 1, this.y).roomName
    }
  }

  private rightNeighbourRoom(): RoomName {
    switch (this.direction) {
    case "NE":
    case "SE":
      return RoomCoordinate.create(this.direction, this.x + 1, this.y).roomName

    case "NW":
      if (this.x > 0) {
        return RoomCoordinate.create(this.direction, this.x - 1, this.y).roomName
      }
      return RoomCoordinate.create("NE", 0, this.y).roomName

    case "SW":
      if (this.x > 0) {
        return RoomCoordinate.create(this.direction, this.x - 1, this.y).roomName
      }
      return RoomCoordinate.create("SE", 0, this.y).roomName
    }
  }

  public sectorName(): string {
    const x = Math.floor(this.x / 10) * 10 + 5
    const y = Math.floor(this.y / 10) * 10 + 5
    return RoomCoordinate.create(this.direction, x, y).roomName
  }

  public getRoomCoordinateTo(dx: number, dy: number): RoomCoordinate {
    const rawX = this.x + dx
    const rawY = this.y + dy

    const x = ((): number => {
      if (rawX >= 0) {
        return rawX
      }
      return Math.max(Math.abs(rawX) - 1, 0)
    })()
    const y = ((): number => {
      if (rawY >= 0) {
        return rawY
      }
      return Math.max(Math.abs(rawY) - 1, 0)
    })()
    const xDirection = ((): "E" | "W" => {
      const current = this.direction[1] as "E" | "W"
      if (rawX >= 0) {
        return current
      }
      switch (current) {
      case "E":
        return "W"
      case "W":
        return "E"
      }
    })()
    const yDirection = ((): "N" | "S" => {
      const current = this.direction[0] as "N" | "S"
      if (rawX >= 0) {
        return current
      }
      switch (current) {
      case "N":
        return "S"
      case "S":
        return "N"
      }
    })()

    const direction = `${yDirection}${xDirection}` as RoomCoordinateDirection
    return RoomCoordinate.create(direction, x, y)
  }

  public isLinearTo(roomName: RoomName): boolean {
    const otherCoordinate = RoomCoordinate.parse(roomName)
    if (otherCoordinate == null) {
      return false
    }

    if (this.xCoordinate === otherCoordinate.xCoordinate || this.yCoordinate === otherCoordinate.yCoordinate) {
      return true
    }
    return false
  }
}

export function roomTypeOf(roomName: RoomName): RoomType | null {
  const coordinate = RoomCoordinate.parse(roomName)
  if (coordinate == null) {
    return null
  }
  return coordinate.roomType
}

export function roomSectorNameOf(roomName: RoomName): string | null {
  const coordinate = RoomCoordinate.parse(roomName)
  if (coordinate == null) {
    return null
  }
  return coordinate.sectorName()
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

function xDirection(direction: RoomCoordinateDirection): "E" | "W" {
  switch (direction) {
  case "NE":
  case "SE":
    return "E"
  case "NW":
  case "SW":
    return "W"
  }
}

function yDirection(direction: RoomCoordinateDirection): "N" | "S" {
  switch (direction) {
  case "NE":
  case "NW":
    return "N"
  case "SE":
  case "SW":
    return "S"
  }
}
