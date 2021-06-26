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

// TODO: Sourceが埋まっていたらよくないことが起きる
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
    const result = PathFinder.search(destination, { pos: position, range: 0 })
    if (result.incomplete === true) {
      pathFindResults.push(`Failed to find path (${position.x}, ${position.y})`)
      return
    }
    results.push(result)
  })

  const shortestPath = results.reduce((lhs, rhs) => lhs.path.length < rhs.path.length ? lhs : rhs)

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
