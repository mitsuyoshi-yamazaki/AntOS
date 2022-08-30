import { GameConstants } from "utility/constants"
import { CreepBody } from "utility/creep_body"
import { calculateTowerDamage } from "utility/tower"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { Invader } from "game/invader"

export type TowerInterceptionTarget = {
  target: AnyCreep
  maxTicksToKill: number | null
  minimumTicksToEscape: number
  damageTaken: number // 0~1
}

type TowerInterceptionResult = {
  target: TowerInterceptionTarget | null
  allTargets: TowerInterceptionTarget[]
}

const roomMinExit = GameConstants.room.edgePosition.min
const roomMaxExit = GameConstants.room.edgePosition.max
const maxTicksToKillLimit = 100
const closeToEdge = 3
const roomEdges = {
  min: roomMinExit + closeToEdge,
  max: roomMaxExit - closeToEdge,
}

export const TowerInterception = {
  attackTarget(roomResource: OwnedRoomResource): TowerInterceptionResult {
    const towerPositions = roomResource.activeStructures.towers
      .filter(tower => tower.store.getUsedCapacity(RESOURCE_ENERGY) > 10)
      .map(tower => tower.pos)

    const targetInfo = attackTarget(roomResource, towerPositions)
    if (targetInfo.target == null) {
      return targetInfo
    }

    const target = targetInfo.target

    if (roomResource.controller.safeMode == null) {
      if ((target.target instanceof Creep) && roomResource.hostiles.creeps.length > 1) {
        const shouldStopAttacking = ((): boolean => {
          const damage = towerPositions.reduce((result, current) => {
            return result + calculateTowerDamage(current.getRangeTo(target.target.pos))
          }, 0)
          const healPower = target.target.pos.findInRange(FIND_HOSTILE_CREEPS, 1).reduce((result, current) => {
            return result + CreepBody.power(current.body, "heal")
          }, 0)

          if (healPower < damage && (target.target.getActiveBodyparts(TOUGH) < 3) || (target.target.owner.username === Invader.username)) {
            return false
          }
          const hasAttacker = target.target.pos.findInRange(FIND_MY_CREEPS, 2).some(creep => creep.getActiveBodyparts(ATTACK) > 0)
          if (hasAttacker !== true) {
            return true
          }
          return false
        })()

        if (shouldStopAttacking === true) {
          return {
            target: null,
            allTargets: targetInfo.allTargets,
          }
        }
      }
    }

    return targetInfo
  },

  calculateTargetInfo(target: AnyCreep, healPower: number, canMove: boolean, towerPositions: RoomPosition[]): TowerInterceptionTarget {
    const exitDistanceX = Math.min(target.pos.x - roomMinExit, roomMaxExit - target.pos.x)
    const exitDistanceY = Math.min(target.pos.y - roomMinExit, roomMaxExit - target.pos.y)
    const minimumTicksToEscape = Math.min(exitDistanceX, exitDistanceY)

    const damageTaken = (target.hitsMax - target.hits) / Math.max(target.hitsMax, 0)

    if (target.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length > 0) {
      return {
        target,
        maxTicksToKill: null,
        minimumTicksToEscape,
        damageTaken,
      }
    }

    const towerRanges = towerPositions.map(towerPosition => towerPosition.getRangeTo(target.pos))
    const maxTicksToKill = ((): number | null => {
      if (canMove !== true) {
        const totalTowerDamage = towerRanges.reduce((result, current) => {
          return result + calculateTowerDamage(current)
        }, 0)
        const totalDamage = totalTowerDamage - healPower
        if (totalDamage <= 0) {
          return null
        }
        return Math.ceil(target.hits / totalDamage)
      }

      let targetHits = target.hits

      for (let i = 0; i < maxTicksToKillLimit; i += 1) {
        const totalTowerDamage = towerRanges.reduce((result, current) => {
          return result + calculateTowerDamage(current + i)
        }, 0)
        const totalDamage = totalTowerDamage - healPower
        if (totalDamage <= 0) {
          return null
        }
        targetHits -= totalDamage
        if (targetHits <= 0) {
          return i + 1
        }
      }
      return maxTicksToKillLimit
    })()

    return {
      target,
      maxTicksToKill,
      minimumTicksToEscape,
      damageTaken,
    }
  },

  canKill(target: TowerInterceptionTarget, roomResource: OwnedRoomResource): boolean {
    if (roomResource.controller.safeMode != null) {
      return true
    }
    if (target.maxTicksToKill == null) {
      return false
    }
    return (target.maxTicksToKill - (target.minimumTicksToEscape * 3)) < 3
  },
}

function attackTarget(roomResource: OwnedRoomResource, towerPositions: RoomPosition[]): TowerInterceptionResult {
  if (towerPositions.length <= 0) {
    return {
      target: null,
      allTargets: [],
    }
  }

  if (roomResource.hostiles.creeps.length <= 1 && roomResource.hostiles.creeps[0] != null) {
    const hostileCreep = roomResource.hostiles.creeps[0]
    const healPower = CreepBody.power(hostileCreep.body, "heal")
    const canMove = hostileCreep.getActiveBodyparts(MOVE) > 0
    const towerMinimumDamage = towerPositions.length * 150
    if (healPower < (towerMinimumDamage / 2)) {
      const { min, max } = GameConstants.room.edgePosition
      if (hostileCreep.pos.x > min && hostileCreep.pos.x < max && hostileCreep.pos.y > min && hostileCreep.pos.y < max) {
        const targetInfo = TowerInterception.calculateTargetInfo(hostileCreep, healPower, canMove, towerPositions)
        return {
          target: targetInfo,
          allTargets: [targetInfo],
        }
      }
    }
  }

  const hostileCreeps: AnyCreep[] = [
    ...roomResource.hostiles.creeps,
    ...roomResource.hostiles.powerCreeps,
  ]

  // killできないとなったら諦めて別targetを選定
  const targetInfo = hostileCreeps.map(target => {
    if (target instanceof Creep) {
      const healPower = CreepBody.power(target.body, "heal")
      const canMove = target.getActiveBodyparts(MOVE) > 0
      return TowerInterception.calculateTargetInfo(target, healPower, canMove, towerPositions)
    } else {
      return TowerInterception.calculateTargetInfo(target, 0, true, towerPositions)
    }
  })

  // キルしやすい順
  targetInfo.sort((lhs, rhs) => {
    if (lhs.maxTicksToKill != null && rhs.maxTicksToKill == null) {
      return -1
    }
    if (lhs.maxTicksToKill == null && rhs.maxTicksToKill != null) {
      return 1
    }
    if (lhs.maxTicksToKill != null && rhs.maxTicksToKill != null) {
      const canKillLhs = TowerInterception.canKill(lhs, roomResource)
      const canKillRhs = TowerInterception.canKill(lhs, roomResource)
      if (canKillLhs === true && canKillRhs !== true) {
        return -1
      }
      if (canKillLhs !== true && canKillRhs === true) {
        return 1
      }
      if (canKillLhs === true && canKillRhs === true) {
        return lhs.maxTicksToKill - rhs.maxTicksToKill
      }
    }
    return 0
  })

  const nextTargetInfo = targetInfo[0]
  if (nextTargetInfo == null) {
    return {
      target: null,
      allTargets: [],
    }
  }
  const towerMinimumRange = towerPositions
    .map(position => position.getRangeTo(nextTargetInfo.target.pos))
    .sort()[0]
  if (towerMinimumRange != null && towerMinimumRange < 12) {
    return {
      target: nextTargetInfo,
      allTargets: targetInfo,
    }
  }
  if (nextTargetInfo.maxTicksToKill == null) {
    return {
      target: null,
      allTargets: [],
    }
  }
  const canEscape = ((): boolean => {
    if (nextTargetInfo.maxTicksToKill < (nextTargetInfo.minimumTicksToEscape * 2)) {
      return false
    }
    const position = nextTargetInfo.target.pos
    if (position.x <= roomEdges.min || position.x >= roomEdges.max || position.y <= roomEdges.min || position.y >= roomEdges.max) {
      return true
    }
    return false
  })()
  if (roomResource.roomInfo.config?.forceAttack !== true && canEscape === true) {
    if (roomResource.room.name === "W43S2") {
      console.log("can escape")
    }
    return {
      target: null,
      allTargets: [],
    }
  }
  return {
    target: nextTargetInfo,
    allTargets: targetInfo,
  }
}
