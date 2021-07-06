import { SpawnCreepTask } from "game_object_task/spwan_task/spawn_creep_task"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveState } from "old_objective/objective"
import { CreepName, V4CreepMemory } from "prototype/creep"

interface SpawnCreepObjectiveProgressInfo {
  spawnedCreepNames: CreepName[]
  canceledCreepNames: CreepName[]
}

interface SpawnCreepObjectiveFailedInfo {
  reason: string
  queuedCreepNames: string[]
}

type SpawnCreepObjectiveProgressType = ObjectiveInProgress<SpawnCreepObjectiveProgressInfo> | ObjectiveFailed<SpawnCreepObjectiveFailedInfo>

/** It cancels current spawning unless the priority is SpawnPriorityHigh or SpawnPriorityUrgent */
// export type SpawnPriorityUrgent = 3  // TODO: implement
export type SpawnPriorityHigh = 2
export type SpawnPriorityNormal = 1
export type SpawnPriorityLow = 0

// export const spawnPriorityUrgent = 3
export const spawnPriorityHigh: SpawnPriorityHigh = 2
export const spawnPriorityNormal: SpawnPriorityNormal = 1
export const spawnPriorityLow: SpawnPriorityLow = 0

// export type SpawnPriority = SpawnPriorityUrgent | SpawnPriorityHigh | SpawnPriorityNormal | SpawnPriorityLow
export type SpawnPriority = SpawnPriorityHigh | SpawnPriorityNormal | SpawnPriorityLow

export interface SpawnCreepQueueItem {
  /** time added to cache */
  t: number

  /** priority */
  p: SpawnPriority

  /** creep name */
  n: string

  /** body parts */
  b: BodyPartConstant[]

  /** memory */
  m: V4CreepMemory
}

export interface SpawnCreepObjectiveState extends ObjectiveState {
  /** room name */
  q: SpawnCreepQueueItem[],
}

/**
 * - succeededしない
 * - spawnがなくなったらfailedして終了
 */
export class SpawnCreepObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private readonly queue: SpawnCreepQueueItem[],
  ) {
  }

  public encode(): SpawnCreepObjectiveState {
    return {
      t: "SpawnCreepObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      q: this.queue,
    }
  }

  public static decode(state: SpawnCreepObjectiveState): SpawnCreepObjective {
    const children = decodeObjectivesFrom(state.c)
    return new SpawnCreepObjective(state.s, children, state.q)
  }

  // ---- Pulbic API ---- //
  public enqueueCreep(creepName: string, body: BodyPartConstant[], memory: V4CreepMemory, priority: SpawnPriority): void {
    this.queue.push({
      t: Game.time,
      p: priority,
      n: creepName,
      b: body,
      m: memory,
    })
    this.queue.sort((lhs, rhs) => { // TODO: 低コストで作成できるcreepは優先度を上げる: ひとまずはpriority highで対応する
      if (lhs.p === rhs.p) {
        return 0
      }
      return lhs > rhs ? -1 : 1
    })
  }

  public removeQueuedCreep(creepName: string): void {
    const index = this.queue.findIndex(item => item.n === creepName)
    if (index < 0) {
      return
    }
    this.queue.splice(index, 1)
  }

  public repairCreep(): void {
    // TODO:
  }

  public progress(room: Room, activeSpawns: StructureSpawn[]): SpawnCreepObjectiveProgressType {
    const indexes = this.queue.filter(q => q.n.includes("baked_jelly")).map(name => this.queue.indexOf(name)) // FixMe:
    indexes.forEach(index => {
      if (index >= 0) {
        this.queue.splice(index, 1)
      }
    })

    if (activeSpawns.length <= 0) {
      return this.noSpawnFailed(room)
    }
    const info = this.runSpawns(activeSpawns)

    return new ObjectiveInProgress(info)
  }

  // ---- Private ---- //
  private runSpawns(spawns: StructureSpawn[]): SpawnCreepObjectiveProgressInfo {
    const info: SpawnCreepObjectiveProgressInfo = {
      spawnedCreepNames: [],
      canceledCreepNames: [],
    }

    spawns.forEach(spawn => {
      if (spawn.spawning != null) {
        return
      }
      if (spawn.task == null) {
        this.assignNewTask(spawn)
      }
      if (spawn.task == null) {
        return
      }
      const result = spawn.task.run(spawn)
      switch (result) {
      case "in progress":
        return
      case "finished":
        if (spawn.task instanceof SpawnCreepTask) {
          info.spawnedCreepNames.push(spawn.task.creepName)
        }
        spawn.task = null
        return
      case "failed":
        if (spawn.task instanceof SpawnCreepTask) {
          info.canceledCreepNames.push(spawn.task.creepName)
        }
        spawn.task = null
        return
      }
    })

    return info
  }

  private assignNewTask(spawn: StructureSpawn): void {
    const nextItem = this.queue.shift()
    if (nextItem == null) {
      return
    }
    spawn.task = new SpawnCreepTask(Game.time, nextItem.n, nextItem.b, nextItem.m)
  }

  private noSpawnFailed(room: Room): ObjectiveFailed<SpawnCreepObjectiveFailedInfo> {
    const spawnInfo = room.find(FIND_MY_SPAWNS).map(spawn => [spawn.name, spawn.isActive()])
    const failedInfo: SpawnCreepObjectiveFailedInfo = {
      reason: `SpawnCreepObjective spawn argument length is 0. room.find(FIND_MY_SPAWNS) returns: ${spawnInfo}`,
      queuedCreepNames: this.queue.map(item => item.n)
    }
    return new ObjectiveFailed(failedInfo)
  }
}
