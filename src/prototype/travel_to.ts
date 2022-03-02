import { GameConstants } from "utility/constants"
import { createRoomPositionId, Position } from "./room_position"

/**
 * - Cacheする経路を道の上のみに制限する
 * - キャッシュを同一の部屋のみになるよう変更する
 *   - 異なる部屋を目指す場合はまずexit positionを求め、exit positionをkeyにしてキャッシュを検索する
 */

export type TravelToState = {
  /** last position */
  lp: {
    p: Position

    /** ticks stacked */
    s: number
  }
}

export type TravelToOptions = {
  range?: number
  cachePath?: boolean
  showPath?: boolean
  stackedValue?: number
  findPathOpts?: FindPathOpts
  moveTo?: () => CreepMoveReturnCode | ERR_NO_PATH | ERR_INVALID_TARGET | ERR_NOT_FOUND
}

type TravelToReturnType = OK
  | ERR_NOT_OWNER
  | ERR_NO_PATH
  | ERR_NOT_FOUND
  | ERR_BUSY
  | ERR_NOT_IN_RANGE
  | ERR_INVALID_ARGS
  | ERR_INVALID_TARGET
  | ERR_TIRED
  | ERR_NO_BODYPART

export function travelTo(creep: Creep, position: RoomPosition, options?: TravelToOptions): TravelToReturnType {
  if (creep.spawning === true) {
    return ERR_BUSY
  }
  if (creep.fatigue > 0) {
    return ERR_TIRED
  }
  const range = options?.range ?? 0
  if (creep.pos.getRangeTo(position) <= range) {
    return OK
  }

  const travelToState = ((): TravelToState => {
    const stored = creep.memory.tr
    if (stored != null) {
      return stored
    }
    const newState: TravelToState = {
      lp: {
        p: { x: creep.pos.x, y: creep.pos.y },
        s: 0,
      }
    }
    creep.memory.tr = newState
    return newState
  })()

  let canUseCachedPath = true
  const {x, y} = {...travelToState.lp.p}
  if (creep.pos.isEqualTo(x, y) === true) {
    travelToState.lp.s += 1
    if (options?.stackedValue != null && travelToState.lp.s > options.stackedValue) {
      canUseCachedPath = false
    }
  } else {
    travelToState.lp = {
      p: { x: creep.pos.x, y: creep.pos.y },
      s: 0,
    }
  }

  if (creep.room.controller != null && creep.room.controller.my === true) {
    canUseCachedPath = false
  }

  if (options?.cachePath === true && canUseCachedPath === true) {
    if (options?.showPath === true) {
      showPath(creep.pos, position)
    }

    const cachedDirection = PathCache.cachedDirection(creep.pos, position)
    if (cachedDirection != null) {
      return creep.move(cachedDirection)
    }

    const path = creep.pos.findPathTo(position, options?.findPathOpts)
    PathCache.cachePath(creep.pos, position, path)

    return creep.moveByPath(path)
  } else {
    if (options?.moveTo != null) {
      return options.moveTo()
    }
    return creep.moveTo(position, options?.findPathOpts)  // TODO:
  }
}

type DirectionPath = { [currentPositionId: string]: DirectionConstant }
type CachedPath = { [destinationPositionId: string]: DirectionPath }

export type PathCacheMemory = {
  paths: CachedPath
}

const PathCache = {
  cachedDirection(currentPosition: RoomPosition, destinationPosition: RoomPosition): DirectionConstant | null {
    const cachedPath = getCachedPathMemory()[destinationPosition.id]
    if (cachedPath == null) {
      return null
    }
    return cachedPath[currentPosition.id] ?? null
  },

  cachedPath(currentPosition: RoomPosition, destinationPosition: RoomPosition): Position[] | null {
    const cachedPath = getCachedPathMemory()[destinationPosition.id]
    if (cachedPath == null) {
      return null
    }

    const result: Position[] = []
    const roomName = currentPosition.roomName
    let position: Position = {x: currentPosition.x, y: currentPosition.y}
    const max = GameConstants.room.size * 2
    for (let i = 0; i < max; i += 1) {
      const roomPositionId = createRoomPositionId(position.x, position.y, roomName)
      const direction = cachedPath[roomPositionId]
      if (direction == null) {
        break
      }
      result.push(position)
      position = nextPosition(position, direction)
    }

    return result
  },

  cachePath(currentPosition: RoomPosition, destinationPosition: RoomPosition, path: PathStep[]): void {
    const currentRoomName = currentPosition.roomName
    const cachedPath = getCachedPathFor(destinationPosition)
    path.reduce((result, current) => {
      const roomPositionId = createRoomPositionId(result.x, result.y, currentRoomName)
      cachedPath[roomPositionId] = current.direction
      return {
        x: current.x,
        y: current.y,
      }
    }, {x: currentPosition.x, y: currentPosition.y} as Position)
  },
}

function getCachedPathMemory(): CachedPath {
  return Memory.pathCache.paths
}

function getCachedPathFor(destinationPosition: RoomPosition): { [currentPositionId: string]: DirectionConstant } {
  const destinationId = destinationPosition.id
  const cachedPathMemory = getCachedPathMemory()
  const stored = cachedPathMemory[destinationId]
  if (stored != null) {
    return stored
  }

  const newPath: DirectionPath = {}
  cachedPathMemory[destinationId] = newPath
  return newPath
}

function nextPosition(currentPosition: Position, direction: DirectionConstant): Position {
  switch (direction) {
  case TOP:
    return {x: currentPosition.x, y: currentPosition.y - 1}
  case TOP_RIGHT:
    return {x: currentPosition.x + 1, y: currentPosition.y - 1}
  case RIGHT:
    return { x: currentPosition.x + 1, y: currentPosition.y }
  case BOTTOM_RIGHT:
    return { x: currentPosition.x + 1, y: currentPosition.y + 1 }
  case BOTTOM:
    return { x: currentPosition.x, y: currentPosition.y + 1 }
  case BOTTOM_LEFT:
    return { x: currentPosition.x - 1, y: currentPosition.y + 1 }
  case LEFT:
    return { x: currentPosition.x - 1, y: currentPosition.y }
  case TOP_LEFT:
    return { x: currentPosition.x - 1, y: currentPosition.y - 1 }
  }
}

function showPath(currentPosition: RoomPosition, destinationPosition: RoomPosition): void {
  const path = PathCache.cachedPath(currentPosition, destinationPosition)
  if (path == null) {
    return
  }
  const visual = new RoomVisual(currentPosition.roomName)
  path.forEach(position => {
    visual.text("#", position.x, position.y, {color: "#FF0000"})
  })
}

// type ReturnTypeSpecifier = "string" | "number" | "boolean"
// type ReturnType<T extends ReturnTypeSpecifier> = T extends "string" ? string :
//   T extends "number" ? number :
//   T extends "boolean" ? boolean :
//   never

// // function getValue<T extends ReturnTypeSpecifier>(typeSpecifier: T): ReturnType<T> {
// //   switch (typeSpecifier) {
// //   case "string":
// //     return ""
// //   case "number":
// //     return 0
// //   case "boolean":
// //     return false
// //   }
// // }

// const ValueGetter: { [K in ReturnTypeSpecifier]: () => ReturnType<K> } = {
//   string(): string {
//     return ""
//   },
//   number(): number {
//     return 0
//   },
//   boolean(): boolean {
//     return false
//   },
// }

// function getValue<T extends ReturnTypeSpecifier>(typeSpecifier: T): ReturnType<T> {
//   const getter = ValueGetter[typeSpecifier] as (() => ReturnType<T>)
//   // const getter = ValueGetter[typeSpecifier] as (() => string)
//   return getter()
// }
