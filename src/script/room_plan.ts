import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { GameConstants } from "utility/constants"
import { ValuedArrayMap, ValuedMapMap } from "utility/valued_collection"
import { Result } from "utility/result"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ErrorMapper } from "error_mapper/ErrorMapper"

export function showOldRoomPlan(roomName: RoomName, layoutName: string, originX: number, originY: number): string {
  const room = Game.rooms[roomName]
  if (room == null) {
    return `Room ${roomLink(roomName)} is not visible`
  }

  room.show_layout(layoutName, { allow_partial: true, origin_pos: { x: originX, y: originY } })
  return "ok"
}

// Game.rooms["W53S36"].find(FIND_FLAGS).forEach(flag => flag.remove())
export function placeOldRoomPlan(roomName: RoomName, layoutName: string, originX: number, originY: number): string {
  const room = Game.rooms[roomName]
  if (room == null) {
    return `Room ${roomLink(roomName)} is not visible`
  }

  room.place_layout(layoutName, { allow_partial: true, origin_pos: { x: originX, y: originY } })
  return "ok"
}

export function describeLabs(roomName: RoomName): string {
  const room = Game.rooms[roomName]
  if (room == null) {
    return `Room ${roomLink(roomName)} is not visible`
  }
  const result = parseLabs(room)
  switch (result.resultType) {
  case "succeeded":
    return `inputs: ${result.value.inputLab1.pos}, ${result.value.inputLab2.pos}, outputs: ${result.value.outputLabs.length} labs`
  case "failed":
    return result.reason
  }
}

export function parseLabs(room: Room): Result<{ inputLab1: StructureLab, inputLab2: StructureLab, outputLabs: StructureLab[] }, string> {
  const labs = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[]
  let minX = GameConstants.room.edgePosition.max
  let maxX = GameConstants.room.edgePosition.min
  let minY = GameConstants.room.edgePosition.max
  let maxY = GameConstants.room.edgePosition.min

  labs.forEach(lab => {
    if (lab.pos.x < minX) {
      minX = lab.pos.x
    }
    if (lab.pos.x > maxX) {
      maxX = lab.pos.x
    }
    if (lab.pos.y < minY) {
      minY = lab.pos.y
    }
    if (lab.pos.y > maxY) {
      maxY = lab.pos.y
    }
  })

  const labPattern = new ValuedArrayMap<number, StructureLab>()
  labs.forEach(lab => {
    const labPosition = ((): number => {
      if (lab.pos.x === minX || lab.pos.x === maxX || lab.pos.y === minY || lab.pos.y === maxY) {
        return 0
      }
      const x = Math.min(lab.pos.x - minX, maxX - lab.pos.x)
      const y = Math.min(lab.pos.y - minY, maxY - lab.pos.y)
      return x + y
    })()
    labPattern.getValueFor(labPosition).push(lab)
  })

  const inputLabs: StructureLab[] = []
  const outputLabs: StructureLab[] = []

  const getLabCount = (labPosition: number): number => labPattern.get(labPosition)?.length ?? 0
  if (getLabCount(0) === 8 && getLabCount(2) === 2) {
    inputLabs.push(...labPattern.getValueFor(2))
    outputLabs.push(...labPattern.getValueFor(0))
  } else if (getLabCount(0) === 4 && getLabCount(2) === 2 && getLabCount(3) === 4) {
    inputLabs.push(...labPattern.getValueFor(2))
    outputLabs.push(...labPattern.getValueFor(0))
    outputLabs.push(...labPattern.getValueFor(3))
  } else {
    const description: string[] = Array.from(labPattern.entries()).map(([labPosition, labs]) => `${labPosition}-${labs.length}`)
    return Result.Failed(`Unknown lab pattern: ${description.join(", ")}`)
  }

  const inputLab1 = inputLabs[0]
  const inputLab2 = inputLabs[1]
  if (inputLab1 == null || inputLab2 == null || inputLabs.length !== 2) {
    PrimitiveLogger.programError(`parseLabs() unexpected behavior (${inputLabs.length} inputLabs)`)
    return Result.Failed(`parseLabs() unexpected behavior (${inputLabs.length} inputLabs)`)
  }
  return Result.Succeeded({
    inputLab1,
    inputLab2,
    outputLabs,
  })
}

export function showRoomPlan(room: Room): string {
  const result = calculateRoomPlan(room)
  switch (result.resultType) {
  case "succeeded":
    return "ok"
  case "failed":
    return result.reason
  }
}

export function calculateRoomPlan(room: Room): Result<void, string> {
  const firstSpawnPosition = calculateFirstSpawnPosition(room)
  if (firstSpawnPosition == null) {
    return Result.Failed("Failed to calculate first spawn position")
  }

  PrimitiveLogger.log(`calculateRoomPlan() first spawn position: ${firstSpawnPosition}`)
  // room.visual.text("*", firstSpawnPosition, {color: "#ff0000"})

  return Result.Succeeded(undefined)
}

function calculateFirstSpawnPosition(room: Room): RoomPosition | null {
  const spawn = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })[0] as StructureSpawn | null
  if (spawn != null) {
    return spawn.pos
  }

  const positions = ErrorMapper.wrapLoop((): RoomPosition[] => {
    return roomOpenPositions(room)
  }, "V5TaskTargetCache.clearCache()")()

  if (positions == null) {
    return null
  }
  return positions[0] ?? null
}

function roomOpenPositions(room: Room): RoomPosition[] {
  const min = GameConstants.room.edgePosition.min
  const max = GameConstants.room.edgePosition.max
  const edgeMargin = 2
  const edgeMin = min + edgeMargin
  const edgeMax = max - edgeMargin

  const minScore = min
  const maxScore = max
  const scores = new ValuedMapMap<number, number, number>()

  for (let y = edgeMin; y <= edgeMax; y += 1) {
    for (let x = edgeMin; x <= edgeMax; x += 1) {
      if (x === edgeMin || x === edgeMax || y === edgeMin || y === edgeMax) {
        scores.getValueFor(y).set(x, maxScore)
        continue
      }
      const terrain = room.lookForAt(LOOK_TERRAIN, x, y)[0]
      switch (terrain) {
      case "plain":
      case "swamp":
        break
      case "wall":
      default:
        scores.getValueFor(y).set(x, maxScore)
        break
      }
    }
  }

  if (scores.size <= 0) {
    PrimitiveLogger.log(`roomOpenPositions() no walls in room ${roomLink(room.name)}`)
    return [new RoomPosition(25, 25, room.name)]
  }
  for (let score = maxScore; score >= minScore; score -= 1) {
    fillScore(score, scores)
  }

  const margin = 5
  const minMargin = min + margin
  const maxMargin = max - margin

  let minimumScore = maxScore
  const result: RoomPosition[] = []
  for (let y = minMargin; y <= maxMargin; y += 1) {
    for (let x = minMargin; x <= maxMargin; x += 1) {
      const score = scores.getValueFor(y).get(x) ?? maxScore
      // room.visual.text(`${score}`, x, y, { color: "#ffffff" })
      try {
        if (score < minimumScore) {
          minimumScore = score
          result.splice(0, result.length)
          result.push(new RoomPosition(x, y, room.name))
        } else if (score === minimumScore) {
          result.push(new RoomPosition(x, y, room.name))
        }
      } catch (e) {
        PrimitiveLogger.programError(`roomOpenPositions() failed ${e}`)
      }
    }
  }
  PrimitiveLogger.log(`roomOpenPositions() minium score: ${minimumScore} ${roomLink(room.name)}`)
  return result
}

function fillScore(score: number, scores: ValuedMapMap<number, number, number>): void {
  if (score <= 0) {
    return
  }
  const neighbourScore = score - 1

  const min = GameConstants.room.edgePosition.min
  const max = GameConstants.room.edgePosition.max

  for (let y = min + 1; y <= max - 1; y += 1) {
    for (let x = min + 1; x <= max - 1; x += 1) {
      const storedScore = scores.getValueFor(y).get(x)
      if (storedScore == null) {
        continue
      }
      if (storedScore !== score) {
        continue
      }
      neighbourPositions(x, y).forEach(position => {
        const storedNeighbourScore = scores.getValueFor(position.y).get(position.x)
        if (storedNeighbourScore == null || neighbourScore > storedNeighbourScore) {
          scores.getValueFor(position.y).set(position.x, neighbourScore)
        } else {
          scores.getValueFor(position.y).set(position.x, storedNeighbourScore)
        }
      })
    }
  }
}

function neighbourPositions(x: number, y: number): { x: number, y: number }[] {
  const result: { x: number, y: number }[] = []
  for (let j = -1; j <= 1; j += 1) {
    for (let i = -1; i <= 1; i += 1) {
      if (j === 0 && i === 0) {
        continue
      }
      result.push({
        x: x + i,
        y: y + j,
      })
    }
  }
  return result
}
