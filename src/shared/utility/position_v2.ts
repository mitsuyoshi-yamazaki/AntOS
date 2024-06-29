import { AvailableRoomPositions } from "./room_position"

export type Position = {
  readonly x: AvailableRoomPositions
  readonly y: AvailableRoomPositions
}

export const isEqualLocalPosition = (position1: Position, position2: Position): boolean => {
  return position1.x === position2.x && position1.y === position2.y
}
