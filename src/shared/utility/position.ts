export type Position = {
  readonly x: number
  readonly y: number
}

export const isEqualLocalPosition = (position1: Position, position2: Position): boolean => {
  return position1.x === position2.x && position1.y === position2.y
}
