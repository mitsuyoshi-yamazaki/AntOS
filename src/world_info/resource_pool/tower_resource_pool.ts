import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomName } from "utility/room_name"
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
}
export interface TowerHealTask {
  towerTaskType: "heal"
  target: AnyCreep
  priority: TowerPoolTaskPriority
}
export interface TowerRepairTask {
  towerTaskType: "repair"
  target: AnyStructure
  priority: TowerPoolTaskPriority
}
export type TowerTask = TowerAttackTask | TowerHealTask | TowerRepairTask
export const TowerTask = {
  Attack: function (target: AnyCreep, priority: TowerPoolTaskPriority): TowerAttackTask {
    return {
      towerTaskType: "attack",
      target,
      priority,
    }
  },
  Heal: function (target: AnyCreep, priority: TowerPoolTaskPriority): TowerHealTask {
    return {
      towerTaskType: "heal",
      target,
      priority,
    }
  },
  Repair: function (target: AnyStructure, priority: TowerPoolTaskPriority): TowerRepairTask {
    return {
      towerTaskType: "repair",
      target,
      priority,
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
        return
      }
    }
    this.towers.forEach(tower => {
      runTask(task, tower)
    })
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
