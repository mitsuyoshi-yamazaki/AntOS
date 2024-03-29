import type { RoomName, RoomType, RoomTypeHighway, RoomTypeHighwayCrossing, RoomTypeNormal, RoomTypeSectorCenter, RoomTypeSourceKeeper } from "shared/utility/room_name_types"
import { State, Stateful } from "os/infrastructure/state"
import type { Position } from "shared/utility/position"

const RoomCoordinateDirection = ["NE", "NW", "SE", "SW"] as const
type RoomCoordinateDirection = typeof RoomCoordinateDirection[number]

export type Highway = {
  readonly direction: "vertical" | "horizontal"
  readonly startRoomName: RoomName  // top/right // highway_crossingからひとつ入った部屋 // TODO: WS以外の象限で動作するか確認する
  readonly endRoomName: RoomName  // bottom/left
}
type DetailedCoordinateHighway = {
  readonly case: RoomTypeHighway
  readonly highway: Highway
}
type DetailedCoordinateHighwayCrossing = {
  readonly case: RoomTypeHighwayCrossing
  readonly connectedHighways: Highway[]
}
type DetailedCoordinateNormal = {
  readonly case: RoomTypeNormal
}
type DetailedCoordinateSourceKeeper = {
  readonly case: RoomTypeSourceKeeper
}
type DetailedCoordinateSectorCenter = {
  readonly case: RoomTypeSectorCenter
}
type DetailedCoordinate = DetailedCoordinateHighway | DetailedCoordinateHighwayCrossing | DetailedCoordinateNormal | DetailedCoordinateSourceKeeper | DetailedCoordinateSectorCenter

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

export interface RoomCoordinateState extends State {
  readonly t: "RoomCoordinate"
  readonly roomName: RoomName
  readonly direction: RoomCoordinateDirection
  readonly x: number
  readonly y: number
}

export class RoomCoordinate implements Stateful {
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

  public encode(): RoomCoordinateState {
    return {
      t: "RoomCoordinate",
      roomName: this.roomName,
      direction: this.direction,
      x: this.x,
      y: this.y,
    }
  }

  public static decode(state: RoomCoordinateState): RoomCoordinate {
    return new RoomCoordinate(state.roomName, state.direction, state.x, state.y)
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

  public getRoomCoordinateTo(relativePosition: Position): RoomCoordinate
  public getRoomCoordinateTo(dx: number, dy: number): RoomCoordinate
  public getRoomCoordinateTo(...args: [Position] | [number, number]): RoomCoordinate {
    const { dx, dy } = ((): { dx: number, dy: number } => {
      if (typeof args[0] === "number") {
        const numberArgs = args as [number, number]
        return {
          dx: numberArgs[0],
          dy: numberArgs[1],
        }
      }
      return {
        dx: args[0].x,
        dy: args[0].y,
      }
    })()

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

  public exitDirectionTo(roomName: RoomName): TOP | BOTTOM | LEFT | RIGHT | null {
    const exits = Game.map.describeExits(this.roomName)
    if (exits == null) { // sim環境ではundefinedが返る
      return null
    }

    for (const [exitDirection, neighbourRoomName] of Array.from(Object.entries(exits))) {
      if (neighbourRoomName !== roomName) {
        continue
      }
      switch (exitDirection) {
      case "1":
        return TOP
      case "3":
        return RIGHT
      case "5":
        return BOTTOM
      case "7":
        return LEFT
      default:
        return null
      }
    }
    return null
  }

  /**
   * @returns highwayの算出は象限をまたぐときに1部屋分ずれる
   */
  public detailedCoordinate(): DetailedCoordinate {
    const localX = this.x % 10
    const localY = this.y % 10
    const verticalHighway = localX === 0
    const horizontalHighway = localY === 0
    if (verticalHighway && horizontalHighway) {
      const connectedHighways: Highway[] = [
        {
          direction: "horizontal",
          startRoomName: this.getRoomCoordinateTo(1, 0).roomName,
          endRoomName: this.getRoomCoordinateTo(9, 0).roomName,
        },
        {
          direction: "horizontal",
          startRoomName: this.getRoomCoordinateTo(-1, 0).roomName,
          endRoomName: this.getRoomCoordinateTo(-9, 0).roomName,
        },
        {
          direction: "vertical",
          startRoomName: this.getRoomCoordinateTo(0, 1).roomName,
          endRoomName: this.getRoomCoordinateTo(0, 9).roomName,
        },
        {
          direction: "vertical",
          startRoomName: this.getRoomCoordinateTo(0, -1).roomName,
          endRoomName: this.getRoomCoordinateTo(0, -9).roomName,
        },
      ]
      return {
        case: "highway_crossing",
        connectedHighways,
      }
    }

    if (verticalHighway) {
      return {
        case: "highway",
        highway: {
          direction: "vertical",
          startRoomName: this.getRoomCoordinateTo(0, -localY + 1).roomName,
          endRoomName: this.getRoomCoordinateTo(0, -localY + 9).roomName,
        },
      }
    }
    if (horizontalHighway) {
      return {
        case: "highway",
        highway: {
          direction: "horizontal",
          startRoomName: this.getRoomCoordinateTo(-localX + 1, 0).roomName,
          endRoomName: this.getRoomCoordinateTo(-localX + 9, 0).roomName,
        },
      }
    }

    if (this.x % 5 === 0 && this.y % 5 === 0) {
      return {
        case: "sector_center",
      }
    }

    if (localX >= 4 && localX <= 6 && localY >= 4 && localY <= 6) {
      return {
        case: "source_keeper",
      }
    }
    return {
      case: "normal",
    }
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

/**
 * highway crossing以外の部屋
 */
export function getHighwayRooms(highway: Highway): RoomName[] {
  const startRoomCoordinate = RoomCoordinate.parse(highway.startRoomName)

  if (startRoomCoordinate == null) {
    return []
  }

  const roomCount = 9
  switch (highway.direction) {
  case "vertical":
    return Array(roomCount).fill(0).map((x, index) => startRoomCoordinate.getRoomCoordinateTo(0, index).roomName)
  case "horizontal":
    return Array(roomCount).fill(0).map((x, index) => startRoomCoordinate.getRoomCoordinateTo(index, 0).roomName)
  }
}
