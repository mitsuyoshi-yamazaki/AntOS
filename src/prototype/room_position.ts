import { TaskRunnerId, TaskTargetCache } from "object_task/object_task_target_cache"
import { RoomName } from "utility/room_name"

export type RoomPositionIdentifier = string

export interface RoomPositionState {
  x: number,
  y: number,
  r: RoomName,
}

declare global {
  interface RoomPosition {
    neighbours(): RoomPosition[]
    encode(): RoomPositionState
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

  RoomPosition.prototype.encode = function (): RoomPositionState {
    return {
      x: this.x,
      y: this.y,
      r: this.roomName,
    }
  }

  Object.defineProperty(RoomPosition.prototype, "id", {
    get(): RoomPositionIdentifier {
      return `${this.roomName}_${this.x}_${this.y}`
    },
  })

  Object.defineProperty(RoomPosition.prototype, "targetedBy", {
    get(): TaskRunnerId[] {
      return TaskTargetCache.targetingTaskRunnerIds(this.id)
    },
  })
}

export function decodeRoomPosition(state: RoomPositionState): RoomPosition {
  return new RoomPosition(state.x, state.y, state.r)
}
