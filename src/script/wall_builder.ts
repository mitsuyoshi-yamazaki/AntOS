import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { GameConstants } from "utility/constants"
import { roomLink } from "utility/log"
import { ValuedMapMap } from "utility/valued_collection"
import { constructionSiteFlagColorMap } from "v5_task/room_planing/create_construction_site_task"

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
  const importantStructureScore = terrainWallScore + 1

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

  const importantFlagColors: ColorConstant[] = [
    COLOR_GREEN,
    COLOR_PURPLE,
    COLOR_BLUE,
    COLOR_RED,
    COLOR_GREY,
    COLOR_CYAN,
    COLOR_WHITE,
  ]
  const importantStructureTypes: StructureConstant[] = importantFlagColors.flatMap(color => constructionSiteFlagColorMap.get(color) ?? [])
  const positionsToDefend: RoomPosition[] = []

  room.find(FIND_MY_STRUCTURES).forEach(structure => {
    if (importantStructureTypes.includes(structure.structureType) !== true) {
      return
    }
    positionsToDefend.push(structure.pos)
  })

  room.find(FIND_FLAGS).forEach(flag => {
    if (importantFlagColors.includes(flag.color) !== true) {
      return
    }
    positionsToDefend.push(flag.pos)
  })

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

  const margin = 1
  const roomMin = min + margin
  const roomMax = max - margin

  const wallPositions: {position: RoomPosition, wallType: STRUCTURE_RAMPART | STRUCTURE_WALL}[] = []

  for (let j = min; j <= max; j += 1) {
    for (let i = min; i <= max; i += 1) {
      const score = scores.getValueFor(j).get(i)
      if (score !== wallScore) {
        if (showsCostMatrix === true) {
          if (score != null) {
            room.visual.text(`${score}`, i, j, { color: "#FFFFFF" })
          }
        }
        continue
      }

      const x = Math.min(Math.max(i, roomMin), roomMax)
      const y = Math.min(Math.max(j, roomMin), roomMax)

      try {
        const position = new RoomPosition(x, y, room.name)
        const wallType = ((): STRUCTURE_WALL | STRUCTURE_RAMPART | null => {
          if (x !== i || y !== j) {
            return STRUCTURE_RAMPART  // Roomの淵に設置する部分は未完成
          }
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
            return null
          case 1:
            return ((): STRUCTURE_WALL | STRUCTURE_RAMPART => {
              if (room.controller != null && position.getRangeTo(room.controller.pos) <= GameConstants.creep.actionRange.upgradeController) {
                return STRUCTURE_RAMPART
              }
              const structures = position.lookFor(LOOK_STRUCTURES).filter(structure => structure.structureType !== STRUCTURE_WALL)
              if (structures.length > 0) {
                return STRUCTURE_RAMPART
              }
              if (position.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) {
                return STRUCTURE_RAMPART
              }
              if (position.lookFor(LOOK_FLAGS).length > 0) {
                return STRUCTURE_RAMPART
              }
              return STRUCTURE_WALL
            })()
          default:
            return STRUCTURE_RAMPART
          }
        })()

        if (wallType != null) {
          wallPositions.push({
            position,
            wallType,
          })
        } else {
          room.visual.text("n", x, y, { color: "#FFFFFF" })
        }
      } catch (e) {
        PrimitiveLogger.programError(`showWallPlanOf() RoomPosition ${e}`)
      }
    }
  }

  return trimUnreacheableWalls(room, wallPositions, showsCostMatrix)
}

function trimUnreacheableWalls(room: Room, wallPositions: { position: RoomPosition, wallType: STRUCTURE_RAMPART | STRUCTURE_WALL }[], showsCostMatrix: boolean): WallPosition[] {
  const min = GameConstants.room.edgePosition.min
  const max = GameConstants.room.edgePosition.max

  const minScore = min
  const terrainWallScore = minScore
  const wallScore = terrainWallScore + 1
  const entranceScore = wallScore + 1
  const maxScore = max

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

  wallPositions.forEach(position => {
    scores.getValueFor(position.position.y).set(position.position.x, wallScore)
  })

  room.find(FIND_EXIT).forEach(exit => {
    scores.getValueFor(exit.y).set(exit.x, entranceScore)
  })

  const iterateScore = (targetScore: number): { finished: boolean } => {
    let finished = true
    scores.forEach((row, y) => {
      row.forEach((score, x) => {
        if (score !== targetScore) {
          return
        }
        finished = false
        try {
          const position = new RoomPosition(x, y, room.name)
          setNeighbourScore(position, targetScore)
        } catch (e) {
          PrimitiveLogger.programError(`showWallPlanOf() RoomPosition ${e}`)
        }
      })
    })
    return {finished}
  }

  const timeoutScore = maxScore * 4
  for (let i = entranceScore; i <= timeoutScore; i += 1) {
    const { finished } = iterateScore(i)
    if (finished === true) {
      break
    }
  }

  const result: WallPosition[] = wallPositions.flatMap(position => {
    const isReachable = position.position.neighbours().some(neighbourPosition => {
      const score = scores.getValueFor(neighbourPosition.y).get(neighbourPosition.x)
      if (score == null) {
        return false
      }
      if (score === wallScore || score === terrainWallScore) {
        return false
      }
      return true
    })

    if (isReachable === true) {
      const text = ((): string => {
        switch (position.wallType) {
        case STRUCTURE_RAMPART:
          return "R"
        case STRUCTURE_WALL:
          return "W"
        }
      })()
      room.visual.text(text, position.position.x, position.position.y, { color: "#FF0000" })

      return {
        x: position.position.x,
        y: position.position.y,
        wallType: position.wallType,
      }
    }
    return []
  })

  if (showsCostMatrix === true) {
    scores.forEach((row, y) => {
      row.forEach((score, x) => {
        room.visual.text(`${score}`, x, y, { color: "#FFFF00" })
      })
    })
  }

  return result
}
