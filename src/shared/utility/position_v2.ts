import { AvailableRoomPositions } from "./room_position"
import { Position as AnyPosition } from "./position"
export { AnyPosition }

export type Position = {
  readonly x: AvailableRoomPositions
  readonly y: AvailableRoomPositions
}

export type PositionSpecifier = string
export type EncodedPosition = Position & {
  readonly specifier: PositionSpecifier
}

export const describePosition = (position: AnyPosition): string => `(${position.x},${position.y})`
export const getPositionSpecifier = (position: AnyPosition): string => `${position.x}_${position.y}`

export const isEqualLocalPosition = (position1: AnyPosition, position2: AnyPosition): boolean => {
  return position1.x === position2.x && position1.y === position2.y
}

export const positionDistance = (position1: AnyPosition, position2: AnyPosition): number => {
  return Math.max(Math.abs(position1.x - position2.x), Math.abs(position1.y - position2.y))
}


export const getDirectionFrom = (from: Position, to: Position): DirectionConstant => getDirection(to.x - from.x, to.y - from.y)
export const getDirection = (dx: number, dy: number): DirectionConstant => {

  const adx = Math.abs(dx)
  const ady = Math.abs(dy)

  if (adx > ady * 2) {
    if (dx > 0) {
      return RIGHT
    } else {
      return LEFT
    }
  }
  if (ady > adx * 2) {
    if (dy > 0) {
      return BOTTOM
    } else {
      return TOP
    }
  }

  if (dx > 0 && dy > 0) {
    return BOTTOM_RIGHT
  }
  if (dx > 0 && dy < 0) {
    return TOP_RIGHT
  }
  if (dx < 0 && dy > 0) {
    return BOTTOM_LEFT
  }
  if (dx < 0 && dy < 0) {
    return TOP_LEFT
  }
  return TOP
}
