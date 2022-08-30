import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomName } from "shared/utility/room_name"
import { Rooms } from "world_info/room_info"
import { ResourcePoolType } from "./resource_pool"

/** 別タスクの実行中であっても上書きする */
type TowerPoolTaskPriorityUrgent = 0

/** タスク実行中でない場合にアサインする */
type TowerPoolTaskPriorityLow = 1

const towerPoolTaskPriorityUrgent: TowerPoolTaskPriorityUrgent = 0
const towerPoolTaskPriorityLow: TowerPoolTaskPriorityLow = 1

export type TowerPoolTaskPriority = TowerPoolTaskPriorityUrgent | TowerPoolTaskPriorityLow
export const TowerPoolTaskPriority = {
  Urgent: towerPoolTaskPriorityUrgent,
  Low: towerPoolTaskPriorityLow,
}

type TowerTaskType = "attack" | "heal" | "repair"
export interface TowerAttackTask {
  towerTaskType: "attack"
  target: AnyCreep
  priority: TowerPoolTaskPriority
  needsAllTowers: boolean
}
export interface TowerHealTask {
  towerTaskType: "heal"
  target: AnyCreep
  priority: TowerPoolTaskPriority
  needsAllTowers: boolean
}
export interface TowerRepairTask {
  towerTaskType: "repair"
  target: AnyStructure
  priority: TowerPoolTaskPriority
  needsAllTowers: boolean
}
export type TowerTask = TowerAttackTask | TowerHealTask | TowerRepairTask
export const TowerTask = {
  Attack: function (target: AnyCreep, priority: TowerPoolTaskPriority, options?: {needsAllTowers?: boolean}): TowerAttackTask {
    return {
      towerTaskType: "attack",
      target,
      priority,
      needsAllTowers: options?.needsAllTowers ?? true,
    }
  },
  Heal: function (target: AnyCreep, priority: TowerPoolTaskPriority, options?: { needsAllTowers?: boolean }): TowerHealTask {
    return {
      towerTaskType: "heal",
      target,
      priority,
      needsAllTowers: options?.needsAllTowers ?? true,
    }
  },
  Repair: function (target: AnyStructure, priority: TowerPoolTaskPriority, options?: { needsAllTowers?: boolean }): TowerRepairTask {
    return {
      towerTaskType: "repair",
      target,
      priority,
      needsAllTowers: options?.needsAllTowers ?? true,
    }
  },
}

export class TowerPool implements ResourcePoolType<StructureTower> {
  private readonly towers: StructureTower[] = []
  private tasks: TowerTask[] = []

  public constructor(
    public readonly parentRoomName: RoomName,
  ) { }

  public addResource(tower: StructureTower): void {
    this.towers.push(tower)
  }

  public addTask(task: TowerTask): void {
    this.tasks.push(task)
  }

  public executeTask(): void {
    if (this.tasks.length <= 0) {
      return
    }
    const task = this.tasks.sort((lhs, rhs) => { // TODO: 個別に異なるタスクを実行できるようにする
      if (lhs.priority === rhs.priority) {
        return taskTypePriority(lhs) < taskTypePriority(rhs) ? -1 : 1
      }
      return lhs.priority < rhs.priority ? -1 : 1
    })[0]

    if (task == null) {
      return
    }
    if (task.towerTaskType === "heal") {
      const enemyAttackerExists = ((): boolean => {
        const objects = Rooms.getOwnedRoomObjects(this.parentRoomName)
        if (objects == null) {
          return false
        }
        if (objects.hostiles.creeps.some(hostileCreep => hostileCreep.getActiveBodyparts(ATTACK) > 0 || hostileCreep.getActiveBodyparts(RANGED_ATTACK) > 0) === true) {
          return true
        }
        return false
      })()
      if (enemyAttackerExists === true) {
        if ((task.target instanceof Creep) && task.target.getActiveBodyparts(ATTACK) > 0) {
          // heal
        } else {
          return
        }
      }
    }

    if (task.needsAllTowers === true) {
      this.towers.forEach(tower => {
        runTask(task, tower)
      })
      return
    }

    const towers = this.towers.map(tower => {
      return {
        tower,
        range: tower.pos.getRangeTo(task.target),
      }
    })
    towers.sort((lhs, rhs) => {
      if (lhs.range !== rhs.range) {
        return lhs.range - rhs.range
      }
      return rhs.tower.store.getUsedCapacity(RESOURCE_ENERGY) - lhs.tower.store.getUsedCapacity(RESOURCE_ENERGY)
    })
    const tower = towers[0]
    if (tower != null) {
      runTask(task, tower.tower)
    }
  }
}

const taskTypePriorityMap = new Map<TowerTaskType, number>([
  ["attack", 0],
  ["heal", 1],
  ["repair", 2],
])

function taskTypePriority(task: TowerTask): number {
  const priority = taskTypePriorityMap.get(task.towerTaskType)
  if (priority == null) {
    PrimitiveLogger.fatal(`[Program bug] ${task.towerTaskType} is not contained in priority map`)
    return 3
  }
  return priority
}

function runTask(task: TowerTask, tower: StructureTower): void {
  switch (task.towerTaskType) {
  case "attack":
    tower.attack(task.target)
    break
  case "heal":
    tower.heal(task.target)
    break
  case "repair":
    tower.repair(task.target)
    break
  }
}
