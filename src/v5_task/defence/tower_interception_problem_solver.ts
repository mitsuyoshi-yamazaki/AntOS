import { ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "v5_problem/problem_solver"
import { RoomName } from "utility/room_name"
import { Task, TaskStatus } from "v5_task/task"
import { TowerPoolTaskPriority, TowerTask } from "world_info/resource_pool/tower_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { GameConstants } from "utility/constants"
import { CreepBody } from "utility/creep_body"

type TargetInfo = {
  target: AnyCreep
  maxTicksToKill: number | null
  minimumTicksToEscape: number
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
    const targetInfo = this.attackTarget(objects)
    if (targetInfo == null) {
      this.targetId = null
      return TaskStatus.Finished
    }

    const target = targetInfo.target
    this.targetId = target.id
    World.resourcePools.addTowerTask(this.roomName, TowerTask.Attack(target, TowerPoolTaskPriority.Urgent))

    const text = `${targetInfo.maxTicksToKill}|${targetInfo.minimumTicksToEscape}`
    objects.controller.room.visual.text(text, target.pos, {color: "#FFFFFF"})

    // TODO: エネルギー足りなくなったらproblemを出す
    return TaskStatus.InProgress
  }

  private attackTarget(objects: OwnedRoomObjects): TargetInfo | null {
    const towerPositions = objects.activeStructures.towers
      .filter(tower => tower.store.getUsedCapacity(RESOURCE_ENERGY) > 10)
      .map(tower => tower.pos)

    if (towerPositions.length <= 0) {
      return null
    }

    const hostileCreeps: AnyCreep[] = [
      ...objects.hostiles.creeps,
      ...objects.hostiles.powerCreeps,
    ]
    if (this.roomName === "W37S35" && hostileCreeps[0] != null) {
      return {
        target: hostileCreeps[0],
        maxTicksToKill: 1,
        minimumTicksToEscape: 1,
      }
    }

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

    const canKill = (ticksToKill: number, ticksToEscape: number): boolean => {
      return (ticksToKill - (ticksToEscape * 3)) < 3
    }

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

function calculateTargetInfo(target: AnyCreep, healPower: number, canMove: boolean, towerPositions: RoomPosition[]): TargetInfo {
  const exitDistanceX = Math.min(target.pos.x - roomMinExit, roomMaxExit - target.pos.x)
  const exitDistanceY = Math.min(target.pos.y - roomMinExit, roomMaxExit - target.pos.y)
  const minimumTicksToEscape = Math.min(exitDistanceX, exitDistanceY)

  if (target.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: {structureType: STRUCTURE_RAMPART}}).length > 0) {
    return {
      target,
      maxTicksToKill: null,
      minimumTicksToEscape,
    }
  }

  const towerRanges = towerPositions.map(towerPosition => towerPosition.getRangeTo(target.pos))
  const maxTicksToKill = ((): number | null => {
    if (canMove !== true) {
      const totalTowerDamage = towerRanges.reduce((result, current) => {
        return result + towerDamage(current)
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
        return result + towerDamage(current + i)
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
  }
}

function towerDamage(range: number): number {
  if (range >= 20) {
    return 150
  }
  if (range <= 5) {
    return 600
  }
  return 600 - ((range - 5) * 30)
}
