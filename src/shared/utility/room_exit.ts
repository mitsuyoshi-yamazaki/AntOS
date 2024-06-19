import { AvailableRoomPositions } from "./room_position"

export type RoomExit = {
  readonly direction: TOP | BOTTOM | LEFT | RIGHT
  readonly position: AvailableRoomPositions
}

export const positionFromExit = (exit: RoomExit): { x: AvailableRoomPositions, y: AvailableRoomPositions } => {
  switch (exit.direction) {
  case TOP:
    return { x: exit.position, y: 0 }
  case BOTTOM:
    return { x: exit.position, y: 49 }
  case LEFT:
    return { x: 0, y: exit.position }
  case RIGHT:
    return { x: 49, y: exit.position }
  default: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _: never = exit.direction
    return {x: 0, y: 0}
  }
  }
}
