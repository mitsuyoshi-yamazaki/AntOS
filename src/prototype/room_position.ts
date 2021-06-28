declare global {
  interface RoomPosition {
    neighbours(): RoomPosition[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  RoomPosition.prototype.neighbours = function (): RoomPosition[] {
    const result: RoomPosition[] = []
    for (let j = -1; j <= 1; j += 1) {
      for (let i = -1; i <= 1; i += 1) {
        if (i === 0 && j === 0) {
          continue
        }
        const x = this.x + i
        const y = this.y + j
        if (x < 0 || x > 49 || y < 0 || y > 49) {
          continue
        }
        result.push(new RoomPosition(x, y, this.roomName))
      }
    }
    return result
  }
}
