import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

export function showPositionsInRange(position: RoomPosition, range: number): void {
  PrimitiveLogger.log(`Include all: ${position.positionsInRange(range, {excludeItself: true, excludeTerrainWalls: false, excludeStructures: false, excludeWalkableStructures: false})}`)
  PrimitiveLogger.log(`Include structures: ${position.positionsInRange(range, { excludeItself: true, excludeTerrainWalls: true, excludeStructures: false, excludeWalkableStructures: false })}`)
  PrimitiveLogger.log(`Exclude all: ${position.positionsInRange(range, { excludeItself: true, excludeTerrainWalls: true, excludeStructures: true, excludeWalkableStructures: true })}`)
}
