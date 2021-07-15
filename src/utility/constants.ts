// ---- Pathfinding ---- //
export const SWAMP_COST = 5
export const OBSTACLE_COST = 255

// ---- Creep Action ---- //
export const UPGRADE_CONTROLLER_RANGE = 3
export const TRANSFER_RESOURCE_RANGE = 1

// ---- Spawn ---- //
export function estimatedRenewDuration(bodySize: number, ticksToLive: number): number {
  const remainingTime = CREEP_LIFE_TIME - ticksToLive
  const increases = Math.floor(600 / bodySize)
  return Math.floor(remainingTime / increases)
}
