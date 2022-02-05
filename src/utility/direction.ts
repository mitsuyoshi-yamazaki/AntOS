export const DirectionConstants = [
  TOP,
  BOTTOM,
  LEFT,
  RIGHT,
  TOP_LEFT,
  TOP_RIGHT,
  BOTTOM_LEFT,
  BOTTOM_RIGHT,
]

export function isDirectionConstant(arg: number): arg is DirectionConstant {
  if ((DirectionConstants as number[]).includes(arg) === true) {
    return true
  }
  return false
}

export function oppositeDirection(direction: DirectionConstant): DirectionConstant {
  switch (direction) {
  case TOP:
    return BOTTOM
  case TOP_RIGHT:
    return BOTTOM_LEFT
  case RIGHT:
    return LEFT
  case BOTTOM_RIGHT:
    return TOP_LEFT
  case BOTTOM:
    return TOP
  case BOTTOM_LEFT:
    return TOP_RIGHT
  case LEFT:
    return RIGHT
  case TOP_LEFT:
    return BOTTOM_RIGHT
  }
}

export function oppositeDirections(direction: DirectionConstant): DirectionConstant[] {
  switch (direction) {
  case TOP:
    return [BOTTOM_LEFT, BOTTOM, BOTTOM_RIGHT]
  case TOP_RIGHT:
    return [LEFT, BOTTOM_LEFT, BOTTOM]
  case RIGHT:
    return [TOP_LEFT, LEFT, BOTTOM_LEFT]
  case BOTTOM_RIGHT:
    return [TOP, TOP_LEFT, LEFT]
  case BOTTOM:
    return [TOP_LEFT, TOP, TOP_RIGHT]
  case BOTTOM_LEFT:
    return [TOP, TOP_RIGHT, RIGHT]
  case LEFT:
    return [TOP_RIGHT, RIGHT, BOTTOM_RIGHT]
  case TOP_LEFT:
    return [RIGHT, BOTTOM_RIGHT, BOTTOM]
  }
}

const directionNameMap: {[direction in DirectionConstant]: string} = {
  1: "top",
  2: "top_right",
  3: "right",
  4: "bottom_right",
  5: "bottom",
  6: "bottom_left",
  7: "left",
  8: "top_left",
}
export function directionName(direction: DirectionConstant): string {
  return directionNameMap[direction]
}
