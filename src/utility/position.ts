export interface Position {
  x: number
  y: number
}

export function distance(lhs: Position, rhs: Position): number {
  return Math.max(Math.abs(lhs.x - rhs.x), Math.abs(lhs.y - rhs.y))
}
