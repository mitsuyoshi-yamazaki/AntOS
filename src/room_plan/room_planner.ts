import { roomLink } from "utility/log"
import { GameConstants } from "utility/constants"
import { ValuedArrayMap, ValuedMapMap } from "utility/valued_collection"
import { Result } from "utility/result"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { generateUniqueId } from "utility/unique_id"

export class RoomPlanner {
  private executed = false
  private flaggedPoints = new ValuedArrayMap<number, number>() // {[y]: x[]}
  private dryRun: boolean
  private showsCostMatrix: boolean

  public constructor(
    private readonly controller: StructureController,
    options?: { dryRun?: boolean, showsCostMatrix?: boolean },
  ) {
    this.dryRun = options?.dryRun ?? false
    this.showsCostMatrix = options?.showsCostMatrix ?? false
  }

  public run(): Result<{ center: RoomPosition }, string> {
    if (this.executed === true) {
      return Result.Failed("Already run")
    }
    this.executed = true

    const controller = this.controller

    const firstSpawnPosition = calculateFirstSpawnPosition(controller, this.showsCostMatrix)
    if (firstSpawnPosition == null) {
      return Result.Failed("Failed to calculate first spawn position")
    }
    PrimitiveLogger.log(`First spawn position: ${firstSpawnPosition}`)

    const result = ErrorMapper.wrapLoop((): Result<{ center: RoomPosition, upgraderContainerPosition: RoomPosition | null }, string> => {
      return this.placeFlags(firstSpawnPosition)
    }, "placeFlags()")()

    if (result == null) {
      return Result.Failed("Unexpected placeFlags() error")
    }

    if (result.resultType === "succeeded") {
      const room = controller.room
      const routeCenterPosition = result.value.center
      const upgradeContainerPosition = result.value.upgraderContainerPosition

      if (upgradeContainerPosition != null) {
        ErrorMapper.wrapLoop((): void => {
          this.placeRoadOnRoute(routeCenterPosition, upgradeContainerPosition, 1)
        }, "placeRoadOnRoute() upgrader")()
      }

      room.find(FIND_SOURCES).forEach(source => {
        ErrorMapper.wrapLoop((): void => {
          this.placeRoadOnRoute(routeCenterPosition, source.pos, 2)
        }, "placeRoadOnRoute() source")()
      })
    }
    return result
  }

  private placeFlags(firstSpawnPosition: RoomPosition): Result<{ center: RoomPosition, upgraderContainerPosition: RoomPosition | null }, string> {
    const controller = this.controller
    const room = controller.room

    let spawnCount = GameConstants.structure.maxCount[STRUCTURE_SPAWN] + GameConstants.structure.maxCount[STRUCTURE_POWER_SPAWN]
    let towerCount = GameConstants.structure.maxCount[STRUCTURE_TOWER]
    let extensionCount = GameConstants.structure.maxCount[STRUCTURE_EXTENSION]
    const decreaseStructureCount = (mark: LayoutMark): void => {
      switch (mark) {
      case LayoutMark.Spawn:
        spawnCount -= 1
        break
      case LayoutMark.Tower:
        towerCount -= 1
        break
      case LayoutMark.Extension:
        extensionCount -= 1
        break
      default:
        break
      }
    }

    const edgeMargin = 5
    const minStructurePosition = GameConstants.room.edgePosition.min + edgeMargin
    const maxStructurePosition = GameConstants.room.edgePosition.max - edgeMargin
    const sources = room.find(FIND_SOURCES)
    const canPlace = (position: RoomPosition, mark: LayoutMark): boolean => {
      const terrain = position.lookFor(LOOK_TERRAIN)[0]
      switch (terrain) {
      case "plain":
      case "swamp":
        if (mark === LayoutMark.Road) {
          return true
        }
        if (position.x < minStructurePosition || position.x > maxStructurePosition) {
          return false
        }
        if (position.y < minStructurePosition || position.y > maxStructurePosition) {
          return false
        }
        if (position.getRangeTo(controller) <= 3) {
          return false
        }
        if (sources.some(source => source.pos.getRangeTo(position) <= 2) === true) {
          return false
        }
        return true
      case "wall":
      default:
        return false
      }
    }

    const centerPosition = new RoomPosition(firstSpawnPosition.x - 1, firstSpawnPosition.y - 0, firstSpawnPosition.roomName)
    const centerBlockPosition = new RoomPosition(firstSpawnPosition.x - 3, firstSpawnPosition.y - 2, firstSpawnPosition.roomName)
    const layeredPositionDirections: DirectionConstant[][] = [
      [],
      [RIGHT],
      [LEFT],
      [TOP_RIGHT],
      [BOTTOM_RIGHT],
      [TOP_LEFT],
      [BOTTOM_LEFT],
      [TOP],
      [BOTTOM],
      [TOP_RIGHT, TOP_RIGHT],
      [BOTTOM_RIGHT, BOTTOM_RIGHT],
      [TOP_LEFT, TOP_LEFT],
      [BOTTOM_LEFT, BOTTOM_LEFT],
      [TOP_RIGHT, RIGHT],
      [BOTTOM_RIGHT, RIGHT],
      [TOP_LEFT, LEFT],
      [BOTTOM_LEFT, LEFT],
    ]
    const nextBlockPositions: RoomPosition[] = layeredPositionDirections.flatMap(directions => {
      const getPosition = (position: RoomPosition): RoomPosition | null => {
        const direction = directions.shift()
        if (direction == null) {
          return position
        }
        const nextPosition = neighbourBlockPosition(position, direction)
        if (nextPosition == null) {
          return null
        }
        return getPosition(nextPosition)
      }
      return getPosition(centerBlockPosition) ?? []
    })

    const usedBlockPositions: RoomPosition[] = [...nextBlockPositions]
    const placeLayout = (layout: LayoutMark[][], position: RoomPosition): void => {
      const positionIndex = nextBlockPositions.indexOf(position)
      if (positionIndex >= 0) {
        nextBlockPositions.splice(positionIndex, 1)
      }

      let placedStructures = 0
      layout.forEach((row, j) => {
        row.forEach((mark, i) => {
          if (flagColors[mark] == null) {
            return
          }
          try {
            const markPosition = new RoomPosition(position.x + i, position.y + j, position.roomName)
            if (canPlace(markPosition, mark) === true) {
              const roadOnSwamp = ((): boolean => {
                if (mark !== LayoutMark.Road) {
                  return false
                }
                if (markPosition.getRangeTo(centerPosition) >= 4) {
                  return false
                }
                return true
              })()
              this.placeFlag(markPosition, mark, roadOnSwamp)
              decreaseStructureCount(mark)
              if (mark !== LayoutMark.Road) {
                placedStructures += 1
              }
            }
          } catch {
            return
          }
        })
      })

      if (placedStructures >= 4) {
        neighbourBlockPositions(position).forEach(neighbourBlockPosition => {
          if (usedBlockPositions.some(usedBlockPosition => usedBlockPosition.isEqualTo(neighbourBlockPosition)) === true) {
            return
          }
          usedBlockPositions.push(neighbourBlockPosition)
          nextBlockPositions.push(neighbourBlockPosition)
        })
      }
    }

    const { upgraderEnergySourcePosition } = this.placeLinks()

    usedBlockPositions.push(centerBlockPosition)
    placeLayout(centerLayout, centerBlockPosition)
    room.visual.text("6", firstSpawnPosition, { color: "#ff0000" })

    const maxBlockCount = 30
    for (let i = 0; i < maxBlockCount; i += 1) {
      if (nextBlockPositions.length <= 0) {
        if (spawnCount > 0 || towerCount > 0 || extensionCount > 0) {
          return Result.Failed(`placeFlags() no empty position to place ${roomLink(room.name)}`)
        }
        return Result.Succeeded({ center: centerPosition, upgraderContainerPosition: upgraderEnergySourcePosition })
      }

      const blockPositions = [...nextBlockPositions]
      for (const blockPosition of blockPositions) {
        const centerMark = ((): LayoutMark | null => {
          if (towerCount > 0) {
            return LayoutMark.Tower
          }
          if (spawnCount > 0) {
            return LayoutMark.Spawn
          }
          if (extensionCount > 0) {
            return LayoutMark.Extension
          }
          return null
        })()
        if (centerMark == null) {
          return Result.Succeeded({ center: centerPosition, upgraderContainerPosition: upgraderEnergySourcePosition })
        }
        placeLayout(extensionLayout(centerMark), blockPosition)
      }
    }
    return Result.Failed(`placeFlags() max block count reached ${roomLink(room.name)}`)
  }

  private placeLinks(): { upgraderEnergySourcePosition: RoomPosition | null } {
    const options: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeWalkableStructures: true,
      excludeTerrainWalls: true,
    }
    const positions = this.controller.pos.positionsInRange(GameConstants.creep.actionRange.upgradeController, options)
    const positionInfo = [...positions].map(position => {
      const neighbourCount = positions.filter(p => {
        return p.getRangeTo(position) === 1
      }).length

      return {
        position,
        neighbourCount,
      }
    })

    const sortedPositionInfo = positionInfo.sort((lhs, rhs) => {
      return rhs.neighbourCount - lhs.neighbourCount
    })
    const linkPositionInfo = sortedPositionInfo.shift()
    if (linkPositionInfo == null) {
      return {
        upgraderEnergySourcePosition: null,
      }
    }

    this.placeFlag(linkPositionInfo.position, LayoutMark.Link, false)

    const containerPositionInfo = sortedPositionInfo.find(positionInfo => {
      return positionInfo.position.getRangeTo(linkPositionInfo.position) === 1
    })
    if (containerPositionInfo == null) {
      return {
        upgraderEnergySourcePosition: linkPositionInfo.position,
      }
    }
    this.placeFlag(containerPositionInfo.position, LayoutMark.Container, false)
    return {
      upgraderEnergySourcePosition: containerPositionInfo.position,
    }
  }

  private placeFlag(position: RoomPosition, mark: LayoutMark, roadOnSwamp: boolean): void {
    const flagColor = flagColors[mark]
    if (flagColor == null) {
      return
    }
    if (this.flaggedPoints.get(position.y)?.includes(position.x) === true) {
      return
    }
    this.flaggedPoints.getValueFor(position.y).push(position.x)
    if (position.lookFor(LOOK_FLAGS).length > 0) {
      return
    }
    const room = this.controller.room
    if (this.dryRun === true) {
      if (this.showsCostMatrix !== true) {
        room.visual.text(mark, position, { color: "#ffffff" })
      }
    } else {
      if (roadOnSwamp === true && mark === LayoutMark.Road) {
        const terrain = position.lookFor(LOOK_TERRAIN)[0]
        switch (terrain) {
        case "swamp":
          room.createConstructionSite(position, STRUCTURE_ROAD)
          break
        case "plain":
          room.createFlag(position, generateUniqueId(), flagColor)
          break
        case "wall":
        default:
          break
        }
      } else {
        room.createFlag(position, generateUniqueId(), flagColor)
      }
    }
  }

  private placeRoadOnRoute(startPosition: RoomPosition, destination: RoomPosition, roadRange: number): void {
    const route = PathFinder.search(startPosition, { pos: destination, range: 1 })
    route.path.forEach(position => {
      if (position.getRangeTo(destination) < roadRange) {
        return
      }
      this.placeFlag(position, LayoutMark.Road, true)
    })
  }
}

type LayoutMarkBlank = "."
type LayoutMarkRoad = "-"
type LayoutMarkStorage = "s"
type LayoutMarkTerminal = "t"
type LayoutMarkLink = "i"
type LayoutMarkLab = "l"
type LayoutMarkContainer = "c"
type LayoutMarkTower = "o"
type LayoutMarkSpawn = "6"
type LayoutMarkNuker = "n"
type LayoutMarkExtension = "x"
type LayoutMark = LayoutMarkBlank
  | LayoutMarkRoad
  | LayoutMarkStorage
  | LayoutMarkTerminal
  | LayoutMarkLink
  | LayoutMarkLab
  | LayoutMarkContainer
  | LayoutMarkTower
  | LayoutMarkSpawn
  | LayoutMarkNuker
  | LayoutMarkExtension

type LayoutMarkKey = "Blank" | "Road" | "Storage" | "Terminal" | "Link" | "Lab" | "Container" | "Tower" | "Spawn" | "Nuker" | "Extension"
const LayoutMark: { [index in LayoutMarkKey]: LayoutMark } = {
  Blank: ".",
  Road: "-",
  Storage: "s",
  Terminal: "t",
  Link: "i",
  Lab: "l",
  Container: "c",
  Tower: "o",
  Spawn: "6",
  Nuker: "n",
  Extension: "x",
}

const flagColors: { [mark in LayoutMark]?: ColorConstant } = {
  // ".": null
  "-": COLOR_BROWN,
  "s": COLOR_GREEN,
  "t": COLOR_PURPLE,
  "i": COLOR_ORANGE,
  "l": COLOR_BLUE,
  "c": COLOR_YELLOW,
  "o": COLOR_RED,
  "6": COLOR_GREY,
  "n": COLOR_CYAN,
  "x": COLOR_WHITE,
}

const centerLayout: LayoutMark[][] = [
  [".", ".", "-", ".", "."],
  [".", "-", "s", "-", "."],
  ["-", "i", ".", "6", "-"],
  [".", "-", "t", "-", "."],
  [".", ".", "-", ".", "."],
]

function extensionLayout(centerMark: LayoutMark): LayoutMark[][] {
  const ctr = centerMark
  return [
    [".", ".", "-", ".", "."],
    [".", "-", "x", "-", "."],
    ["-", "x", ctr, "x", "-"],
    [".", "-", "x", "-", "."],
    [".", ".", "-", ".", "."],
  ]
}

const neighbourBlockDiff: { [direction in DirectionConstant]: { i: number, j: number } } = {
  [LEFT]: { i: -4, j: 0 },
  [RIGHT]: { i: 4, j: 0 },
  [TOP_LEFT]: { i: -2, j: -2 },
  [TOP_RIGHT]: { i: 2, j: -2 },
  [BOTTOM_RIGHT]: { i: 2, j: 2 },
  [BOTTOM_LEFT]: { i: -2, j: 2 },
  [TOP]: { i: 0, j: -4 },
  [BOTTOM]: { i: 0, j: 4 },
}
function neighbourBlockPositions(position: RoomPosition): RoomPosition[] {
  return Array.from(Object.values(neighbourBlockDiff)).flatMap(diff => {
    try {
      return new RoomPosition(position.x + diff.i, position.y + diff.j, position.roomName)
    } catch {
      return []
    }
  })
}
function neighbourBlockPosition(position: RoomPosition, direction: DirectionConstant): RoomPosition | null {
  try {
    const diff = neighbourBlockDiff[direction]
    return new RoomPosition(position.x + diff.i, position.y + diff.j, position.roomName)
  } catch {
    return null
  }
}

function calculateFirstSpawnPosition(controller: StructureController, showsCostMatrix: boolean): RoomPosition | null {
  const room = controller.room
  const spawn = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })[0] as StructureSpawn | null
  if (spawn != null) {
    return spawn.pos
  }

  const positionScores = ErrorMapper.wrapLoop((): { position: RoomPosition, score: number }[] => {
    return roomOpenPositions(room, showsCostMatrix)
  }, "roomOpenPositions()")()

  if (positionScores == null || positionScores.length <= 0) {
    return null
  }

  const topPositionScores = positionScores
    .sort((lhs, rhs) => lhs.score - rhs.score)
  topPositionScores.splice(20, topPositionScores.length) // 計算量削減のため

  const sources = room.find(FIND_SOURCES)
  const distanceScores = topPositionScores.map(positionScore => {
    const controllerDistance = positionScore.position.findPathTo(controller).length
    const sourceDistance = sources.reduce((result, current) => result + positionScore.position.findPathTo(current).length, 0)
    const distanceScore = controllerDistance + sourceDistance * 0.3
    return {
      position: positionScore.position,
      score: positionScore.score * 10 + distanceScore,
    }
  })
  return distanceScores.sort((lhs, rhs) => {
    return lhs.score - rhs.score
  })[0]?.position ?? null
}

function roomOpenPositions(room: Room, showsCostMatrix: boolean): { position: RoomPosition, score: number }[] {
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
    return [{
      position: new RoomPosition(25, 25, room.name),
      score: minScore,
    }]
  }
  for (let score = maxScore; score >= minScore; score -= 1) {
    fillScore(score, scores)
  }

  const margin = 5
  const minMargin = min + margin * 2  // room planの中心は外側に寄りすぎない
  const maxMargin = max - margin * 2

  const result: { position: RoomPosition, score: number }[] = []
  for (let y = minMargin; y <= maxMargin; y += 1) {
    for (let x = minMargin; x <= maxMargin; x += 1) {
      const score = scores.getValueFor(y).get(x) ?? maxScore
      if (showsCostMatrix === true) {
        room.visual.text(`${score}`, x, y, { color: "#ffffff" })
      }
      try {
        result.push({
          position: new RoomPosition(x, y, room.name),
          score: score
        })
      } catch (e) {
        PrimitiveLogger.programError(`roomOpenPositions() failed ${e}`)
      }
    }
  }
  PrimitiveLogger.log(`roomOpenPositions() ${roomLink(room.name)}`)
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