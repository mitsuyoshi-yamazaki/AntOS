import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { GameConstants } from "utility/constants"
import { roomLink } from "utility/log"
import { ValuedMapMap } from "utility/valued_collection"

export type WallPosition = {
  x: number
  y: number
  wallType: STRUCTURE_RAMPART | STRUCTURE_WALL
}

export function calculateWallPositions(room: Room, showsCostMatrix: boolean): WallPosition[] | string {
  if (room.controller == null || room.controller.my !== true) {
    return `${roomLink(room.name)} is not owned`
  }

  const min = GameConstants.room.edgePosition.min
  const max = GameConstants.room.edgePosition.max

  const minScore = min
  const terrainWallScore = minScore
  const importantStructureScore = minScore + 1

  const scores = new ValuedMapMap<number, number, number>()
  const setNeighbourScore = (position: RoomPosition, score: number): void => {
    const neighbourScore = score + 1
    position.neighbours().forEach(neighbourPosition => {
      const storedNeighbourScore = scores.getValueFor(neighbourPosition.y).get(neighbourPosition.x)
      if (storedNeighbourScore != null && neighbourScore >= storedNeighbourScore) {
        return
      }
      if (storedNeighbourScore == null) {
        if (neighbourPosition.lookFor(LOOK_TERRAIN)[0] === "wall") {
          scores.getValueFor(neighbourPosition.y).set(neighbourPosition.x, terrainWallScore)
          return
        }
      }
      scores.getValueFor(neighbourPosition.y).set(neighbourPosition.x, neighbourScore)
    })
  }

  const positionsToDefend: RoomPosition[] = [
    ...room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } }).map(extension => extension.pos),
    ...room.find(FIND_FLAGS).filter(flag => flag.color === COLOR_WHITE).map(flag => flag.pos),
  ]

  if (positionsToDefend.length < (GameConstants.structure.maxCount.extension * 0.8)) {
    return `Lack of extensions: ${positionsToDefend.length} found (${GameConstants.structure.maxCount.extension} expected)`
  }

  positionsToDefend.forEach(position => {
    scores.getValueFor(position.y).set(position.x, importantStructureScore)
  })

  const iterateScore = (targetScore: number): void => {
    scores.forEach((row, y) => {
      row.forEach((score, x) => {
        if (score !== targetScore) {
          return
        }
        try {
          const position = new RoomPosition(x, y, room.name)
          setNeighbourScore(position, targetScore)
        } catch (e) {
          PrimitiveLogger.programError(`showWallPlanOf() RoomPosition ${e}`)
        }
      })
    })
  }

  const wallScore = importantStructureScore + 3
  for (let i = importantStructureScore; i <= wallScore; i += 1) {
    iterateScore(i)
  }

  const margin = 2
  const roomMin = min + margin
  const roomMax = max - margin

  const wallPositions: WallPosition[] = []

  for (let y = roomMin; y <= roomMax; y += 1) {
    for (let x = roomMin; x <= roomMax; x += 1) {
      const score = scores.getValueFor(y).get(x)
      if (score !== wallScore) {
        if (showsCostMatrix === true) {
          const text = score != null ? `${score}` : "-"
          room.visual.text(text, x, y, { color: "#FFFFFF" })
        }
        continue
      }

      try {
        const position = new RoomPosition(x, y, room.name)
        const outsidePositionCount = position.neighbours()
          .filter(neighbourPosition => {
            const neighbourScore = scores.getValueFor(neighbourPosition.y).get(neighbourPosition.x)
            if (neighbourScore == null) {
              return true
            }
            if (neighbourScore > wallScore) {
              return true
            }
            return false
          })
          .length

        switch (outsidePositionCount) {
        case 0:
          room.visual.text("n", x, y, { color: "#FFFFFF" })
          break
        case 1:
          room.visual.text("W", x, y, { color: "#FF0000" })
          wallPositions.push({
            x,
            y,
            wallType: STRUCTURE_WALL,
          })
          break
        default:
          room.visual.text("R", x, y, { color: "#FF0000" })
          wallPositions.push({
            x,
            y,
            wallType: STRUCTURE_RAMPART,
          })
          break
        }
        wallPositions.push()
      } catch (e) {
        PrimitiveLogger.programError(`showWallPlanOf() RoomPosition ${e}`)
      }
    }
  }

  return wallPositions
}
