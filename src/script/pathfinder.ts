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
  const source = Game.getObjectById(sourceId)
  if (!(source instanceof Source)) {
    return `Invalid source id ${sourceId}`
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
  visualize(harvestPositions, {text: "■", color: "#ff0000"})

  const result = PathFinder.search(spawn.pos, { pos: source.pos, range: 1 })
  if (result.incomplete === true) {
    visualize(result.path, { color: "#ff0000" })
    return "[INCOMPLETE] Pathfinder failed to find path"
  }

  visualize(result.path, { color: "#ffffff" })

  const harvestPositionDescription = harvestPositions.map(p => `(${p.x}, ${p.y})`).join(", ")
  return `Found ${harvestPositions.length} harvest positions: ${harvestPositionDescription}`
}
