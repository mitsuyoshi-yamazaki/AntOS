import { ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "v5_problem/problem_solver"
import { RoomName } from "utility/room_name"
import { Task, TaskStatus } from "v5_task/task"
import { TowerPoolTaskPriority, TowerTask } from "world_info/resource_pool/tower_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { GameConstants } from "utility/constants"
import { CreepBody } from "utility/creep_body"
import { calculateTowerDamage } from "utility/tower"

type TargetInfo = {
  target: AnyCreep
  maxTicksToKill: number | null
  minimumTicksToEscape: number
  damageTaken: number // 0~1
}

export interface TowerInterceptionProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName

  /** target id */
  ti: Id<AnyCreep> | null
}

export class TowerInterceptionProblemSolver extends ProblemSolver {
  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    private targetId: Id<AnyCreep> | null,
  ) {
    super(startTime, children, problemIdentifier)
  }

  public encode(): TowerInterceptionProblemSolverState {
    return {
      t: "TowerInterceptionProblemSolver",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      i: this.problemIdentifier,
      r: this.roomName,
      ti: this.targetId,
    }
  }

  public static decode(state: TowerInterceptionProblemSolverState, children: Task[]): TowerInterceptionProblemSolver {
    return new TowerInterceptionProblemSolver(state.s, children, state.i, state.r, state.ti)
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName): TowerInterceptionProblemSolver {
    return new TowerInterceptionProblemSolver(Game.time, [], problemIdentifier, roomName, null)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const towerPositions = objects.activeStructures.towers
      .filter(tower => tower.store.getUsedCapacity(RESOURCE_ENERGY) > 10)
      .map(tower => tower.pos)

    const targetInfo = this.attackTarget(objects, towerPositions)
    if (targetInfo == null) {
      this.targetId = null
      return TaskStatus.Finished
    }

    const target = targetInfo.target

    if ((target instanceof Creep) && objects.hostiles.creeps.length > 1) {
      const shouldStopAttacking = ((): boolean => {
        const damage = towerPositions.reduce((result, current) => {
          return result + calculateTowerDamage(current.getRangeTo(target.pos))
        }, 0)
        const healPower = target.pos.findInRange(FIND_HOSTILE_CREEPS, 1).reduce((result, current) => {
          return result + CreepBody.power(current.body, "heal")
        }, 0)

        if (healPower < damage) {
          return false
        }
        const hasAttacker = target.pos.findInRange(FIND_MY_CREEPS, 2).some(creep => creep.getActiveBodyparts(ATTACK) > 0)
        if (hasAttacker !== true) {
          return true
        }
        return false
      })()

      if (shouldStopAttacking === true) {
        this.targetId = null
        return TaskStatus.Finished
      }
    }

    this.targetId = target.id
    World.resourcePools.addTowerTask(this.roomName, TowerTask.Attack(target, TowerPoolTaskPriority.Urgent))

    const text = `${targetInfo.maxTicksToKill}|${targetInfo.minimumTicksToEscape}`
    objects.controller.room.visual.text(text, target.pos, {color: "#FFFFFF"})

    // TODO: エネルギー足りなくなったらproblemを出す
    return TaskStatus.InProgress
  }

  private attackTarget(objects: OwnedRoomObjects, towerPositions: RoomPosition[]): TargetInfo | null {
    if (towerPositions.length <= 0) {
      return null
    }

    if (objects.hostiles.creeps.length <= 1 && objects.hostiles.creeps[0] != null) {
      const hostileCreep = objects.hostiles.creeps[0]
      const healPower = CreepBody.power(hostileCreep.body, "heal")
      const canMove = hostileCreep.getActiveBodyparts(MOVE) > 0
      const towerMinimumDamage = towerPositions.length * 150
      if (healPower < (towerMinimumDamage / 2)) {
        const {min, max} = GameConstants.room.edgePosition
        if (hostileCreep.pos.x > min && hostileCreep.pos.x < max && hostileCreep.pos.y > min && hostileCreep.pos.y < max) {
          return calculateTargetInfo(hostileCreep, healPower, canMove, towerPositions)
        }
      }
    }

    const hostileCreeps: AnyCreep[] = [
      ...objects.hostiles.creeps,
      ...objects.hostiles.powerCreeps,
    ]

    // killできないとなったら諦めて別targetを選定
    const targetInfo = hostileCreeps.map(target => {
      if (target instanceof Creep) {
        const healPower = CreepBody.power(target.body, "heal")
        const canMove = target.getActiveBodyparts(MOVE) > 0
        return calculateTargetInfo(target, healPower, canMove, towerPositions)
      } else {
        return calculateTargetInfo(target, 0, true, towerPositions)
      }
    })
    const currentTarget = ((): AnyCreep | null => {
      if (this.targetId == null) {
        return null
      }
      return Game.getObjectById(this.targetId)
    })()

    const canKill = ((): (ticksToKill: number, ticksToEscape: number) => boolean => {
      if (objects.controller.safeMode != null) {
        return (): boolean => true
      }
      return (ticksToKill: number, ticksToEscape: number): boolean => {
        return (ticksToKill - (ticksToEscape * 3)) < 3
      }
    })()



    if (currentTarget != null) {
      const currentTargetId = currentTarget.id
      const currentTargetInfo = targetInfo.find(info => info.target.id === currentTargetId)
      if (currentTargetInfo != null && currentTargetInfo.maxTicksToKill != null) {
        if (canKill(currentTargetInfo.maxTicksToKill, currentTargetInfo.minimumTicksToEscape) === true) {
          return currentTargetInfo
        }
      }
    }

    // キルしやすい順
    targetInfo.sort((lhs, rhs) => {
      if (lhs.maxTicksToKill != null && rhs.maxTicksToKill == null) {
        return -1
      }
      if (lhs.maxTicksToKill == null && rhs.maxTicksToKill != null) {
        return 1
      }
      if (lhs.maxTicksToKill != null && rhs.maxTicksToKill != null) {
        const canKillLhs = canKill(lhs.maxTicksToKill, lhs.minimumTicksToEscape)
        const canKillRhs = canKill(rhs.maxTicksToKill, rhs.minimumTicksToEscape)
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
      return null
    }
    const towerMinimumRange = towerPositions
      .map(position => position.getRangeTo(nextTargetInfo.target.pos))
      .sort()[0]
    if (towerMinimumRange != null && towerMinimumRange < 12) {
      return nextTargetInfo
    }
    if (nextTargetInfo.maxTicksToKill == null) {
      return null
    }
    if (nextTargetInfo.maxTicksToKill > (nextTargetInfo.minimumTicksToEscape * 2)) {
      return null
    }
    return nextTargetInfo
  }
}

const roomMinExit = GameConstants.room.edgePosition.min
const roomMaxExit = GameConstants.room.edgePosition.max
const maxTicksToKillLimit = 100

export function calculateTargetInfo(target: AnyCreep, healPower: number, canMove: boolean, towerPositions: RoomPosition[]): TargetInfo {
  const exitDistanceX = Math.min(target.pos.x - roomMinExit, roomMaxExit - target.pos.x)
  const exitDistanceY = Math.min(target.pos.y - roomMinExit, roomMaxExit - target.pos.y)
  const minimumTicksToEscape = Math.min(exitDistanceX, exitDistanceY)

  const damageTaken = (target.hitsMax - target.hits) / Math.max(target.hitsMax, 0)

  if (target.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: {structureType: STRUCTURE_RAMPART}}).length > 0) {
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
}
