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
    visualize(result.path, {color: "#ff0000"})
    return "[INCOMPLETE] Pathfinder failed to find path"
  }

  visualize(result.path, { color: "#ffffff" })
  return "ok"
}

function visualize(path: RoomPosition[], options?: {color: string}): void {
  path.forEach(position => {
    const room = Game.rooms[position.roomName]
    room.visual.text("*", position, options)
  })
}
