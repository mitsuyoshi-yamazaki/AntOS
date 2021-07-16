// ---- Pathfinding ---- //
/** @deprecated */
export const SWAMP_COST = 5

/** @deprecated */
export const OBSTACLE_COST = 255

// ---- Creep Action ---- //
/** @deprecated */
export const UPGRADE_CONTROLLER_RANGE = 3

/** @deprecated */
export const TRANSFER_RESOURCE_RANGE = 1

/** @deprecated */
export const REPAIR_RANGE = 3

/** @deprecated */
export const HARVEST_RANGE = 1

// ---- Spawn ---- //
export function estimatedRenewDuration(bodySize: number, ticksToLive: number): number {
  const remainingTime = CREEP_LIFE_TIME - ticksToLive
  const increases = Math.floor(600 / bodySize)
  return Math.floor(remainingTime / increases)
}

export const GameConstants = {
  room: {
    edgePosition: {
      min: 0,
      max: 49,
    },
  },
  creep: {
    actionRange: {
      build: 3,
      repair: REPAIR_RANGE,
      harvest: HARVEST_RANGE,
      transferResource: TRANSFER_RESOURCE_RANGE,
      upgradeController: UPGRADE_CONTROLLER_RANGE,
    },
    actionPower: {
      build: BUILD_POWER,
      upgradeController: UPGRADE_CONTROLLER_POWER,
    },
  }
}

// ---- Direction ---- //
export function randomDirection(seed: number): DirectionConstant {
  const rawDirection = (seed % 8) + 1
  return rawDirection as DirectionConstant
}

export function directionDescription(direction: DirectionConstant): string {
  switch (direction) {
  case TOP:
    return "top"
  case TOP_RIGHT:
    return "top_right"
  case RIGHT:
    return "right"
  case BOTTOM_RIGHT:
    return "bottom_right"
  case BOTTOM:
    return "bottom"
  case BOTTOM_LEFT:
    return "bottom_left"
  case LEFT:
    return "left"
  case TOP_LEFT:
    return "top_left"
  }
}
