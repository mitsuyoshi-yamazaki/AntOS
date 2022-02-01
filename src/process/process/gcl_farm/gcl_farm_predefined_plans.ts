import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Position } from "prototype/room_position"

export type GclFarmPositions = {
  storagePosition: Position,
  terminalPosition: Position,
  spawnPosition: Position,
  distributorPosition: Position,
  tower1Position: Position,
  tower2Position: Position,
  // tower3Position: Position,  // 未対応
  upgraderPositions: Position[],
}
export type GclFarmRelativePositions = GclFarmPositions

const gclFarmPredefinedPlans = new Map<string, GclFarmRelativePositions>()

export function getGclFarmPredefinedPlan(name: string): GclFarmRelativePositions | null {
  return gclFarmPredefinedPlans.get(name) ?? null
}

export function calculateAbsoluteGclFarmPositions(relativePositions: GclFarmRelativePositions, storagePosition: Position): GclFarmPositions {
  const positionDiff: Position = {
    x: storagePosition.x - relativePositions.storagePosition.x,
    y: storagePosition.y - relativePositions.storagePosition.y,
  }

  const absolutePositionFor = (position: Position): Position => {
    return {
      x: position.x + positionDiff.x,
      y: position.y + positionDiff.y,
    }
  }

  return {
    storagePosition: absolutePositionFor(relativePositions.storagePosition),
    terminalPosition: absolutePositionFor(relativePositions.terminalPosition),
    spawnPosition: absolutePositionFor(relativePositions.spawnPosition),
    distributorPosition: absolutePositionFor(relativePositions.distributorPosition),
    tower1Position: absolutePositionFor(relativePositions.tower1Position),
    tower2Position: absolutePositionFor(relativePositions.tower2Position),
    upgraderPositions: relativePositions.upgraderPositions.map(position => absolutePositionFor(position)),
  }
}

const plan1: string[][] = [
  [".", "o", "o", "t"],
  ["u", "u", "d", "."],
  ["u", "s", "u", "p"],
  ["u", "u", "u", "."],
]

/** throws */
function parseRawPlan(planMatrix: string[][]): GclFarmRelativePositions {
  const map = new Map<string, Position[]>()
  const getValueList = (value: string): Position[] => {
    const stored = map.get(value)
    if (stored != null) {
      return stored
    }
    const newList: Position[] = []
    map.set(value, newList)
    return newList
  }

  planMatrix.forEach((row, y) => {
    row.forEach((value, x) => {
      const valueList = getValueList(value)
      valueList.push({
        x,
        y,
      })
    })
  })

  /** throws */
  const getPositionFor = (value: string, index?: number): Position => {
    const positionIndex = index ?? 0
    const positions = map.get(value)
    if (positions == null) {
      throw `"${value}" position not set`
    }
    const position = positions[positionIndex]
    if (position == null) {
      throw `"${value}" position not set`
    }
    return position
  }

  const upgraderPositions = map.get("u") ?? []
  if (upgraderPositions.length <= 0) {
    throw '"u" positions not set'
  }

  return {
    storagePosition: getPositionFor("s"),
    terminalPosition: getPositionFor("t"),
    spawnPosition: getPositionFor("p"),
    distributorPosition: getPositionFor("d"),
    tower1Position: getPositionFor("o", 0),
    tower2Position: getPositionFor("o", 1),
    upgraderPositions,
  }
}

try {
  gclFarmPredefinedPlans.set("plan1", parseRawPlan(plan1))
} catch (error) {
  PrimitiveLogger.programError(`GCL farm predefined plan parse failed:\n${error}`)
}
