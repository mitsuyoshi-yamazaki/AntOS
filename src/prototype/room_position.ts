import { TaskRunnerId, TaskTargetCache } from "v5_object_task/object_task_target_cache"
import { RoomName } from "utility/room_name"

export type RoomPositionIdentifier = string

export interface RoomPositionState {
  x: number,
  y: number,
  r: RoomName,
}

export interface RoomPositionFilteringOptions {
  excludeItself: boolean
  excludeTerrainWalls: boolean
  excludeStructures: boolean
  excludeWalkableStructures: boolean
}

declare global {
  interface RoomPosition {
    id: RoomPositionIdentifier
    targetedBy: TaskRunnerId[]

    encode(): RoomPositionState
    neighbours(): RoomPosition[]
    positionsInRange(range: number, options: RoomPositionFilteringOptions): RoomPosition[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
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

  RoomPosition.prototype.encode = function (): RoomPositionState {
    return {
      x: this.x,
      y: this.y,
      r: this.roomName,
    }
  }

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

  RoomPosition.prototype.positionsInRange = function (range: number, options: RoomPositionFilteringOptions): RoomPosition[] {
    const walkableTerrains: Terrain[] = ["swamp", "plain"]
    const walkableStructures: StructureConstant[] = [STRUCTURE_CONTAINER, STRUCTURE_ROAD]
    const positions: RoomPosition[] = []

    for (let j = -range; j <= range; j += 1) {
      for (let i = -range; i <= range; i += 1) {
        if (options.excludeItself && i === 0 && j === 0) {
          continue
        }
        const x = this.x + i
        if (x < 0 || x > 49) {
          continue
        }
        const y = this.y + j
        if (y < 0 || y > 49) {
          continue
        }

        const position = new RoomPosition(x, y, this.roomName)
        const objects = position.look()
        let shouldExclude = false

        for (const obj of objects) {
          if (obj.type === LOOK_TERRAIN && obj.terrain != null && walkableTerrains.includes(obj.terrain) !== true) {
            if (options.excludeTerrainWalls === true) {
              shouldExclude = true
              break
            }
          }
          if (obj.type === LOOK_STRUCTURES && obj.structure != null) {
            if (options.excludeWalkableStructures === true) {
              shouldExclude = true
              break
            }
            if (options.excludeStructures === true && walkableStructures.includes(obj.structure.structureType) === false) {
              shouldExclude = true
              break
            }
          }
        }

        if (shouldExclude === true) {
          continue
        }
        positions.push(position)
      }
    }
    return positions
  }
}

export function decodeRoomPosition(state: RoomPositionState): RoomPosition {
  return new RoomPosition(state.x, state.y, state.r)
}
