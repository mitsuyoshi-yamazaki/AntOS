import { TaskRunnerId as V5TaskRunnerId, TaskTargetCache as V5TaskTargetCache } from "v5_object_task/object_task_target_cache"
import { RoomCoordinate, RoomName } from "utility/room_name"
import { PositionTaskRunnerInfo, TaskTargetCache, TaskTargetCacheTaskType } from "object_task/object_task_target_cache"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { GameConstants } from "utility/constants"

enum RoomPositionIdType { }
export type RoomPositionId = string & RoomPositionIdType

export type Position = {
  readonly x: number
  readonly y: number
}

export function describePosition(position: Position): string {
  return `${position.x},${position.y}`
}

export type RoomPositionState = {
  readonly x: number
  readonly y: number
  readonly r: RoomName
}

export interface RoomPositionFilteringOptions {
  excludeItself: boolean
  excludeTerrainWalls: boolean
  excludeStructures: boolean
  excludeWalkableStructures: boolean
}

declare global {
  interface RoomPosition {
    id: RoomPositionId
    pos: RoomPosition
    isRoomEdge: boolean

    /** @deprecated */
    v5TargetedBy: V5TaskRunnerId[]

    encode(): RoomPositionState
    targetedBy(taskType: TaskTargetCacheTaskType): PositionTaskRunnerInfo
    neighbours(): RoomPosition[]
    positionsInRange(range: number, options: RoomPositionFilteringOptions): RoomPosition[]

    /**
     * @param direction 返り値のRoomPositionが部屋の外である場合はnullを返す（new RoomPosition(x + i, y + j, roomName) に失敗した際）
     */
    positionTo(direction: DirectionConstant): RoomPosition | null
    nextRoomPositionTo(direction: DirectionConstant): RoomPosition
    nextRoomEdgePosition(): RoomPosition | null
  }
}

export function createRoomPositionId(x: number, y: number, roomName: RoomName): RoomPositionId {
  return `${roomName}_${x},${y}` as RoomPositionId
}

// 毎tick呼び出すこと
export function init(): void {
  try {
    Object.defineProperty(RoomPosition.prototype, "id", {
      get(): RoomPositionId {
        return createRoomPositionId(this.x, this.y, this.roomName)
      },
    })

    Object.defineProperty(RoomPosition.prototype, "pos", {
      get(): RoomPosition {
        return this
      },
    })

    Object.defineProperty(RoomPosition.prototype, "isRoomEdge", {
      get(): boolean {
        return this.x === GameConstants.room.edgePosition.min
          || this.x === GameConstants.room.edgePosition.max
          || this.y === GameConstants.room.edgePosition.min
          || this.y === GameConstants.room.edgePosition.max
      },
    })

    Object.defineProperty(RoomPosition.prototype, "v5TargetedBy", {
      get(): V5TaskRunnerId[] {
        return V5TaskTargetCache.targetingTaskRunnerIds(this.id)
      },
    })

    RoomPosition.prototype.encode = function (): RoomPositionState {
      return {
        x: this.x,
        y: this.y,
        r: this.roomName,
      }
    }

    RoomPosition.prototype.targetedBy = function (taskType: TaskTargetCacheTaskType): PositionTaskRunnerInfo {
      return TaskTargetCache.positionTargetingTaskRunnerInfo(this.id, taskType)
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
      const positions: RoomPosition[] = []
      try {
        const walkableTerrains: Terrain[] = ["swamp", "plain"]
        const walkableStructures: StructureConstant[] = [STRUCTURE_CONTAINER, STRUCTURE_ROAD]

        const needLook = options.excludeStructures === true || options.excludeTerrainWalls === true || options.excludeWalkableStructures === true

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
            if (needLook !== true) {
              positions.push(position)
              continue
            }

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
      } catch (error) {
        PrimitiveLogger.programError(`${this}.positionsInRange() failed: ${error}`)
      }
      return positions
    }

    RoomPosition.prototype.positionTo = function (direction: DirectionConstant): RoomPosition | null {
      const i = ((): (-1 | 0 | 1) => {
        switch (direction) {
        case TOP_LEFT:
        case LEFT:
        case BOTTOM_LEFT:
          return -1
        case TOP:
        case BOTTOM:
          return 0
        case TOP_RIGHT:
        case RIGHT:
        case BOTTOM_RIGHT:
          return 1
        }
      })()
      const j = ((): (-1 | 0 | 1) => {
        switch (direction) {
        case TOP_LEFT:
        case TOP:
        case TOP_RIGHT:
          return -1
        case LEFT:
        case RIGHT:
          return 0
        case BOTTOM_LEFT:
        case BOTTOM:
        case BOTTOM_RIGHT:
          return 1
        }
      })()

      const x = this.x + i
      const y = this.y + j
      try {
        return new RoomPosition(x, y, this.roomName)
      } catch {
        return null
      }
    }

    RoomPosition.prototype.nextRoomPositionTo = function (direction: DirectionConstant): RoomPosition {
      const roomCoordinate = RoomCoordinate.parse(this.roomName)
      if (roomCoordinate == null) {
        PrimitiveLogger.programError(`RoomPosition.nextRoomPositionTo() cannot parse room name ${roomLink(this.roomName)}`)
        return this
      }

      const i = ((): (-1 | 0 | 1) => {
        switch (direction) {
        case TOP_LEFT:
        case LEFT:
        case BOTTOM_LEFT:
          return -1
        case TOP:
        case BOTTOM:
          return 0
        case TOP_RIGHT:
        case RIGHT:
        case BOTTOM_RIGHT:
          return 1
        }
      })()
      const j = ((): (-1 | 0 | 1) => {
        switch (direction) {
        case TOP_LEFT:
        case TOP:
        case TOP_RIGHT:
          return -1
        case LEFT:
        case RIGHT:
          return 0
        case BOTTOM_LEFT:
        case BOTTOM:
        case BOTTOM_RIGHT:
          return 1
        }
      })()

      // 対角線上の部屋への移動は原理上ありえるがおそらくゲームにそのような地形はないので無視する
      const x = this.x + i
      const y = this.y + j
      const min = GameConstants.room.edgePosition.min
      const max = GameConstants.room.edgePosition.max
      try {
        if (x <= min) {
          return new RoomPosition(max, y, roomCoordinate.neighbourRoom(LEFT))
        }
        if (x >= max) {
          return new RoomPosition(min, y, roomCoordinate.neighbourRoom(RIGHT))
        }
        if (y <= min) {
          return new RoomPosition(x, max, roomCoordinate.neighbourRoom(TOP))
        }
        if (y >= max) {
          return new RoomPosition(x, min, roomCoordinate.neighbourRoom(BOTTOM))
        }
        return new RoomPosition(x, y, this.roomName)
      } catch (e) {
        PrimitiveLogger.programError(`RoomPosition.nextRoomPositionTo() faild: ${e}`)
        return this
      }
    }

    RoomPosition.prototype.nextRoomEdgePosition = function (): RoomPosition | null {
      const roomCoordinate = RoomCoordinate.parse(this.roomName)
      if (roomCoordinate == null) {
        PrimitiveLogger.programError(`RoomPosition.nextRoomEdgePosition() cannot parse room name ${roomLink(this.roomName)}`)
        return this
      }

      const min = GameConstants.room.edgePosition.min
      const max = GameConstants.room.edgePosition.max
      try {
        if (this.x <= min) {
          return new RoomPosition(max, this.y, roomCoordinate.neighbourRoom(LEFT))
        }
        if (this.x >= max) {
          return new RoomPosition(min, this.y, roomCoordinate.neighbourRoom(RIGHT))
        }
        if (this.y <= min) {
          return new RoomPosition(this.x, max, roomCoordinate.neighbourRoom(TOP))
        }
        if (this.y >= max) {
          return new RoomPosition(this.x, min, roomCoordinate.neighbourRoom(BOTTOM))
        }
        return null
      } catch (e) {
        PrimitiveLogger.programError(`RoomPosition.nextRoomEdgePosition() faild: ${e}`)
        return null
      }
    }
  } catch (e) {
    PrimitiveLogger.notice(`${e}`)
  }
}

export function decodeRoomPosition(state: RoomPositionState): RoomPosition
export function decodeRoomPosition(position: Position, roomName: RoomName): RoomPosition
export function decodeRoomPosition(...args: [RoomPositionState] | [Position, RoomName]): RoomPosition {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  function isRoomPositionState(arg: any): arg is [RoomPositionState] {
    return arg[0].r !== undefined
  }
  if (isRoomPositionState(args)) {
    const roomPositionState = args[0]
    try {
      return new RoomPosition(roomPositionState.x, roomPositionState.y, roomPositionState.r)
    } catch (e) {
      PrimitiveLogger.programError(`decodeRoomPosition 1 failed to decode: ${[roomPositionState.x, roomPositionState.y, roomPositionState.r]}`)
      return new RoomPosition(25, 25, roomPositionState.r)
    }
  }
  try {
    return new RoomPosition(args[0].x, args[0].y, args[1])
  } catch (e) {
    PrimitiveLogger.programError(`decodeRoomPosition 2 failed to decode: ${args}`)
    return new RoomPosition(25, 25, args[1])
  }
}
