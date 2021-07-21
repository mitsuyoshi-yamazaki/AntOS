// ---- Pathfinding ---- //

import { PowerConstants } from "./power_constants"

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
    life: {
      spawnTime: CREEP_SPAWN_TIME,
      lifeTime: CREEP_LIFE_TIME,
      claimLifeTime: CREEP_CLAIM_LIFE_TIME,
    },
    actionRange: {
      build: 3,
      repair: REPAIR_RANGE,
      harvest: HARVEST_RANGE,
      transferResource: TRANSFER_RESOURCE_RANGE,
      upgradeController: UPGRADE_CONTROLLER_RANGE,
      attack: 1,
    },
    actionPower: {
      build: BUILD_POWER,
      upgradeController: UPGRADE_CONTROLLER_POWER,
      carryCapacity: CARRY_CAPACITY,
    },
  },
  source: {
    regenerationDuration: 300,
  },
  power: PowerConstants,
}

export const ApplicationConstants = {
  performance: {
    measuringPeriod: CREEP_LIFE_TIME,
  },
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

export function oppositeDirection(direction: DirectionConstant): DirectionConstant {
  switch (direction) {
  case TOP:
    return BOTTOM
  case TOP_RIGHT:
    return BOTTOM_LEFT
  case RIGHT:
    return LEFT
  case BOTTOM_RIGHT:
    return TOP_LEFT
  case BOTTOM:
    return TOP
  case BOTTOM_LEFT:
    return TOP_RIGHT
  case LEFT:
    return RIGHT
  case TOP_LEFT:
    return BOTTOM_RIGHT
  }
}
