import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { Result } from "utility/result"
import { generateUniqueId } from "utility/unique_id"

export function findPath(startObjectId: string, goalObjectId: string): string {
  const startObject = Game.getObjectById(startObjectId)
  if (!(startObject instanceof RoomObject) || startObject.room == null) {
    return `Game object of ${startObject} not found`
  }
  const goalObject = Game.getObjectById(goalObjectId)
  if (!(goalObject instanceof RoomObject) || goalObject.room == null) {
    return `Game object of ${goalObject} not found`
  }

  const options: FindPathOpts = {
    ignoreCreeps: true,
    ignoreDestructibleStructures: true,
    ignoreRoads: false,
    maxRooms: 3,
  }
  const startRoomName = startObject.room.name
  const startRoomPath = startObject.pos.findPathTo(goalObject.pos, options).map(p => {
    return new RoomPosition(p.x, p.y, startRoomName)
  })
  visualize(startRoomPath, { color: "#ffffff" })


  const goalRoomName = goalObject.room.name
  const edgePosition = startRoomPath[startRoomPath.length - 1]
  if (edgePosition == null) {
    return "No path"
  }
  const edgeRoomPosition = new RoomPosition(edgePosition.x, edgePosition.y, startRoomName)
  const goalRoomPath = goalObject.pos.findPathTo(edgeRoomPosition, options).map(p => {
    return new RoomPosition(p.x, p.y, goalRoomName)
  })
  visualize(goalRoomPath, { color: "#ffffff" })

  return "ok"
}

function visualize(positions: RoomPosition[], options?: { color?: string, text?: string }): void {
  const text = options?.text ?? "*"
  positions.forEach(position => {
    const room = Game.rooms[position.roomName]
    if (room == null) {
      return
    }
    room.visual.text(text, position, { color: options?.color, align: "center"})
  })
}

export function findPathToSource(spawnName: string, sourceId: Id<Source>): string {
  const spawn = Game.spawns[spawnName]
  if (spawn == null) {
    return `Spawn ${spawnName} not found`
  }
  const result = calculateSourceRoute(sourceId, spawn.pos)
  switch (result.resultType) {
  case "succeeded": {
    const harvestPositionDescription = result.value.harvestPositions.map(p => `(${p.x}, ${p.y})`).join(", ")
    return `Found ${result.value.harvestPositions.length} harvest positions: ${harvestPositionDescription}`
  }
  case "failed":
    return result.reason
  }
}

interface SourceRoute {
  path: PathFinderPath
  harvestPositions: RoomPosition[]
}

// TODO: Sourceが壁等で埋まっていたらよくないことが起きる
export function calculateSourceRoute(sourceId: Id<Source>, destination: RoomPosition): Result<SourceRoute, string> {
  const source = Game.getObjectById(sourceId)
  if (!(source instanceof Source)) {
    return Result.Failed(`Invalid source id ${sourceId}`)
  }

  const walkableTerrains: Terrain[] = ["swamp", "plain"]
  const harvestPositions = source.pos.neighbours().filter(position => {
    const objects = position.look()
    for (const obj of objects) {
      if (obj.type === LOOK_TERRAIN && obj.terrain != null && walkableTerrains.includes(obj.terrain)) {
        return true
      }
    }
    return false
  })
  visualize(harvestPositions, { text: "■", color: "#ff0000" })

  const pathFindResults: string[] = []
  const results: PathFinderPath[] = []
  harvestPositions.forEach(position => {
    const result = PathFinder.search(destination, { pos: position, range: 1 })
    if (result.incomplete === true) {
      pathFindResults.push(`Failed to find path (${position.x}, ${position.y})`)
      return
    }
    results.push(result)
  })

  // TODO: こういうのをテスタブルにしたい
  const shortestPath = results.reduce((lhs, rhs) => lhs.path.length < rhs.path.length ? lhs : rhs)
  const firstHarvestPosition = harvestPositions[0]
  const lastHarvestPosition = harvestPositions[harvestPositions.length - 1]
  if (shortestPath != null && harvestPositions.length > 0) {
    const lastPosition = shortestPath.path[shortestPath.path.length - 1]
    if (lastPosition != null && firstHarvestPosition != null && lastHarvestPosition != null) {
      if (lastPosition.isNearTo(firstHarvestPosition) === true) {
        // do nothing
      } else if (lastPosition.isNearTo(lastHarvestPosition) === true) {
        harvestPositions.reverse()
      } else {

        // FixMe: 必ずしも動かないわけではないが動くわけでもない
        PrimitiveLogger.fatal(`Pathfinder cannot calculate proper path to source ${sourceId} in ${roomLink(source.room.name)}`)
        harvestPositions.sort((lhs, rhs) => {
          const lValue = Math.abs(lhs.x - lastPosition.x) + Math.abs(lhs.y - lastPosition.y)
          const rValue = Math.abs(rhs.x - lastPosition.x) + Math.abs(rhs.y - lastPosition.y)
          if (lValue === rValue) {
            return 0
          }
          return lValue > rValue ? 1 : -1
        })

        // TODO:
        // const firstHarvestPosition = harvestPositions[0]
        // const lastHarvestPosition = harvestPositions[1]
        // if (firstHarvestPosition.getRangeTo(lastPosition) < lastHarvestPosition.getRangeTo(lastPosition)) {
        //   const betweenPositions = getPathBetween(firstHarvestPosition, lastPosition)
        //   if (betweenPositions == null) {

        //   }
        //   shortestPath.path.
        // } else {
        //   harvestPositions.reverse()
        // }
      }
    }
  }

  visualize(shortestPath.path, { color: "#ffffff" })

  if (shortestPath == null) {
    return Result.Failed(`No route found from (${destination.x}, ${destination.y}) to source (${source.pos.x}, ${source.pos.y})`)
  }

  const result: SourceRoute = {
    path: shortestPath,
    harvestPositions,
  }
  return Result.Succeeded(result)
}

// function getPathBetween(position1: RoomPosition, position2: RoomPosition): RoomPosition[] | null {
//   // TODO: 既存のパスに重ならないようなcost matrix
// }

export function showCachedSourcePath(sourceId: Id<Source>): string {
  const source = Game.getObjectById(sourceId)
  if (source == null) {
    return `Invalid source ID ${sourceId}`
  }

  const cachedPath = getCachedPathFor(source)
  if (cachedPath == null) {
    return `No cached source path for source ${sourceId} in ${roomLink(source.room.name)}`
  }

  const visual = source.room.visual
  cachedPath.forEach(position => visual.text("*", position.x, position.y))
  return "ok"
}

// Roomに持たせる
const sourcePathCache = new Map<Id<Source>, RoomPosition[]>()

export function getCachedPathFor(source: Source): RoomPosition[] | null {
  const cachedPath = sourcePathCache.get(source.id)
  if (cachedPath != null) {
    if (cachedPath.length <= 0) {
      return null
    } else {
      return cachedPath
    }
  }
  if (source.room.memory.p == null) {
    sourcePathCache.set(source.id, [])
    return null
  }
  const memoryCachedPath = source.room.memory.p.s[source.id]
  if (memoryCachedPath == null || memoryCachedPath === "no path") {
    sourcePathCache.set(source.id, [])
    return null
  }
  const roomName = source.room.name
  const roomPositions = memoryCachedPath.p.map(position => new RoomPosition(position.x, position.y, roomName))
  sourcePathCache.set(source.id, roomPositions)
  return roomPositions
}

/**
 * - Owned roomにはflagを、そうでなければConstructionSiteを配置する
 * - startRoom, goalRoom以外の部屋をまたいだ経路には対応していない
 */
export function placeRoadConstructionMarks(startPosition: RoomPosition, goalPosition: RoomPosition, codename: string): Result<void, string> {
  const startRoom = Game.rooms[startPosition.roomName]
  const goalRoom = Game.rooms[goalPosition.roomName]

  if (startRoom == null || goalRoom == null) {
    return Result.Failed(`No visual: ${startRoom}, ${goalRoom}`)
  }

  const options: FindPathOpts = {
    ignoreCreeps: true,
    ignoreDestructibleStructures: true,
    ignoreRoads: false,
    maxRooms: 3,
  }

  const placeMark = (room: Room, position: {x: number, y: number}): void => {
    if (room.controller != null && room.controller.my === true) {
      room.createFlag(position.x, position.y, generateUniqueId(codename), COLOR_BROWN)
      return
    }
    room.createConstructionSite(position.x, position.y, STRUCTURE_ROAD)
  }

  const startRoomPath = startPosition.findPathTo(goalPosition, options)
  const edgePosition = startRoomPath[startRoomPath.length - 1]
  if (edgePosition == null) {
    return Result.Failed(`No path from ${startPosition} to ${goalPosition}`)
  }

  if (startPosition.roomName === goalPosition.roomName) {
    return Result.Succeeded(undefined)
  }

  startRoomPath.forEach(position => {
    placeMark(startRoom, position)
  })
  const edgeRoomPosition = new RoomPosition(edgePosition.x, edgePosition.y, startRoom.name)

  goalPosition.findPathTo(edgeRoomPosition, options).map(position => {
    placeMark(goalRoom, position)
  })

  return Result.Succeeded(undefined)
}
