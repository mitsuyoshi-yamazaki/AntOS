import { roomLink } from "utility/log"
import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"

export function findPath(startObjectId: string, goalObjectId: string, goalRange: number): string {
  const startObject = Game.getObjectById(startObjectId)
  if (!(startObject instanceof RoomObject)) {
    return `Game object of ${startObject} not found`
  }
  const goalObject = Game.getObjectById(goalObjectId)
  if (!(goalObject instanceof RoomObject)) {
    return `Game object of ${goalObject} not found`
  }

  const result = PathFinder.search(startObject.pos, { pos: goalObject.pos, range: goalRange })
  if (result.incomplete === true) {
    visualize(result.path, { color: "#ff0000" })
    return "[INCOMPLETE] Pathfinder failed to find path"
  }

  visualize(result.path, { color: "#ffffff" })
  return "ok"
}

function visualize(positions: RoomPosition[], options?: { color?: string, text?: string }): void {
  const text = options?.text ?? "*"
  positions.forEach(position => {
    const room = Game.rooms[position.roomName]
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
export function calculateSourceRoute(sourceId: Id<Source>, destination: RoomPosition): ResultType<SourceRoute, string> {
  const source = Game.getObjectById(sourceId)
  if (!(source instanceof Source)) {
    return new ResultFailed(`Invalid source id ${sourceId}`)
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

  const shortestPath = results.reduce((lhs, rhs) => lhs.path.length < rhs.path.length ? lhs : rhs)
  if (shortestPath != null) {
    const lastPosition = shortestPath.path[shortestPath.path.length - 1]
    harvestPositions.sort((lhs, rhs) => {
      const lValue = Math.abs(lhs.x - lastPosition.x) + Math.abs(lhs.y - lastPosition.y)
      const rValue = Math.abs(rhs.x - lastPosition.x) + Math.abs(rhs.y - lastPosition.y)
      if (lValue === rValue) {
        return 0
      }
      return lValue > rValue ? 1 : -1
    })
  }

  visualize(shortestPath.path, { color: "#ffffff" })

  if (shortestPath == null) {
    return new ResultFailed(`No route found from (${destination.x}, ${destination.y}) to source (${source.pos.x}, ${source.pos.y})`)
  }

  const result: SourceRoute = {
    path: shortestPath,
    harvestPositions,
  }
  return new ResultSucceeded(result)
}

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
