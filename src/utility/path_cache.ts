import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

export type PathCacheMemory = {
  cache: PathCache
}

type PathCacheDirections = { [roomPositionId: string]: DirectionConstant }
type PathCache = { [destinationPositionId: string]: PathCacheDirections }

export const PathCacheAccessor = {
  /**
   * @param path pathの先頭と末尾がそれぞれDestination Positionとなる
   */
  setPathCache(path: RoomPosition[]): void {
    const firstPosition = path.shift()
    const lastPosition = path.pop()
    if (firstPosition == null || lastPosition == null) {
      return
    }
    const firstPositionId = firstPosition.id
    const lastPositionId = lastPosition.id
    if (firstPositionId === lastPositionId) {
      return
    }

    const pathCache = getPathCache()
    pathCache[firstPositionId] = pathCacheDirectionsFor(path, firstPosition)
    path.reverse()
    pathCache[lastPositionId] = pathCacheDirectionsFor(path, lastPosition)

    PrimitiveLogger.log(`path cached: ${firstPosition} =&gt ... =&gt ${lastPosition}`)  // TODO: デバッグ用
  },

  directionFor(position: RoomPosition, destination: RoomPosition): DirectionConstant | null {
    const path = getPathCache()[destination.id]
    if (path == null) {
      return null
    }
    return path[position.id] ?? null
  },
}

function getPathCache(): PathCache {
  return Memory.pathCache.cache
}

/**
 * @throws
 * @param reversedPath destinationPositionから始点までの経路
 */
function pathCacheDirectionsFor(reversedPath: RoomPosition[], destinationPosition: RoomPosition): PathCacheDirections {
  const directions: PathCacheDirections = {}

  reversedPath.reduce((previousPosition, currentPosition) => {
    const direction = currentPosition.getDirectionTo(previousPosition)
    directions[currentPosition.id] = direction

    return currentPosition
  }, destinationPosition)

  return directions
}


