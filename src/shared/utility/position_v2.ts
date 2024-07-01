import { AvailableRoomPositions } from "./room_position"
import { Position as AnyPosition } from "./position"

export type Position = {
  readonly x: AvailableRoomPositions
  readonly y: AvailableRoomPositions
}

export const isEqualLocalPosition = (position1: AnyPosition, position2: AnyPosition): boolean => {
  return position1.x === position2.x && position1.y === position2.y
}

export const positionDistance = (position1: AnyPosition, position2: AnyPosition): number => {
  return Math.max(Math.abs(position1.x - position2.x), Math.abs(position1.y - position2.y))
}

export { AnyPosition }
