import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { describePosition, Position } from "prototype/room_position"

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
  ["..", "t0", "t1", "te"],
  ["u4", "u5", "di", ".."],
  ["u3", "st", "u0", "sp"],
  ["u2", "u1", "..", ".."],
]

/** throws */
function parseRawPlan(planMatrix: string[][]): GclFarmRelativePositions {
  const map = new Map<string, Position>()
  const upgraderPositions: {index: number, position: Position}[] = []

  planMatrix.forEach((row, y) => {
    row.forEach((key, x) => {
      if (key.startsWith("u") !== true) {
        map.set(key, { x, y })
        return
      }
      const rawIndex = key.slice(1)
      const index = parseInt(rawIndex, 10)
      if (isNaN(index) === true) {
        throw `invalid upgrader position format ${key} at ${describePosition({x, y})}, format: u&ltindex&gt`
      }
      upgraderPositions.push({
        index,
        position: { x, y },
      })
    })
  })

  /** throws */
  const getPositionFor = (key: string): Position => {
    const position = map.get(key)
    if (position == null) {
      throw `"${key}" position not set`
    }
    return position
  }

  if (upgraderPositions.length <= 0) {
    throw '"u" positions not set'
  }
  upgraderPositions.sort((lhs, rhs) => {
    return lhs.index - rhs.index
  })
  // upgraderPositions.forEach(x => console.log(`${x.index}: ${describePosition(x.position)}`))

  return {
    storagePosition: getPositionFor("st"),
    terminalPosition: getPositionFor("te"),
    spawnPosition: getPositionFor("sp"),
    distributorPosition: getPositionFor("di"),
    tower1Position: getPositionFor("t0"),
    tower2Position: getPositionFor("t1"),
    upgraderPositions: upgraderPositions.map(x => x.position),
  }
}

try {
  gclFarmPredefinedPlans.set("plan1", parseRawPlan(plan1))
} catch (error) {
  PrimitiveLogger.programError(`GCL farm predefined plan parse failed:\n${error}`)
}
