declare global {
  interface RoomPosition {
    neighbours(): RoomPosition[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  RoomPosition.prototype.neighbours = function (clockwise?: boolean): RoomPosition[] {
    const relativePositions: { i: number, j: number }[] = [
      { i: -1, j: -1 },
      { i: 0, j: -1 },
      { i: 1, j: -1 },
      { i: 1, j: 0 },
      { i: 1, j: 1 },
      { i: 0, j: 1 },
      { i: -1, j: 1 },
      { i: -1, j: 0 },
    ]
    if (clockwise === false) {
      relativePositions.reverse()
    }
    return relativePositions.reduce((result, current) => {
      const x = this.x + current.i
      if (x < 0 || x > 49) {
        return result
      }
      const y = this.y + current.j
      if (y < 0 || y > 49) {
        return result
      }
      result.push(new RoomPosition(x, y, this.roomName))
      return result
    }, [] as RoomPosition[])
  }
}
