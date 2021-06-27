import { StructureSpawnTask, StructureSpawnTaskState, GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

/** It cancels current spawning unless the priority is SpawnPriorityHigh or SpawnPriorityUrgent */
export type SpawnPriorityUrgent = 3
export type SpawnPriorityHigh = 2
export type SpawnPriorityNormal = 1
export type SpawnPriorityLow = 0

export const spawnPriorityUrgent = 3
export const spawnPriorityHigh = 2
export const spawnPriorityNormal = 1
export const spawnPriorityLow = 0

export type SpawnPriority = SpawnPriorityUrgent | SpawnPriorityHigh | SpawnPriorityNormal | SpawnPriorityLow

interface SpawnCache {
  /** time added to cache */
  t: number

  /** identifier */
  i: string

  /** priority */
  p: SpawnPriority

  /** creep name */
  n: string

  /** body parts */
  b: BodyPartConstant[]

  /** memory */
  m: CreepMemory
}

export interface SpawnCreepTaskState extends StructureSpawnTaskState {
  /** spawn cache */
  c: SpawnCache[]

  /** spawning */
  sp: SpawnCache | null
}

export class SpawnCreepTask implements StructureSpawnTask {
  public readonly taskType = "SpawnCreepTask"
  public readonly shortDescription = "spawn"

  public constructor(
    public readonly startTime: number,
    private readonly spawnCache: SpawnCache[],
    private spawning: SpawnCache | null,
  ) { }

  public encode(): SpawnCreepTaskState {
    return {
      s: this.startTime,
      t: "SpawnCreepTask",
      c: this.spawnCache,
      sp: this.spawning,
    }
  }

  public static decode(state: SpawnCreepTaskState): SpawnCreepTask | null {
    return new SpawnCreepTask(state.s, state.c, state.sp)
  }

  public addCreepToSpawn(identifier: string, creepName: string, body: BodyPartConstant[], memory: CreepMemory, priority: SpawnPriority): void {
    this.spawnCache.push({
      t: Game.time,
      i: identifier,
      p: priority,
      n: creepName,
      b: body,
      m: memory,
    })
    this.spawnCache.sort((lhs, rhs) => {
      if (lhs.p === rhs.p) {
        return 0
      }
      return lhs > rhs ? -1 : 1
    })
  }

  public removeCachedSpawn(creepName: string): void {
    const index = this.spawnCache.findIndex(cache => cache.n === creepName)
    if (index < 0) {
      return
    }
    this.spawnCache.splice(index, 1)
  }

  public cacheLengthOf(identifier: string): number {
    return this.spawnCache.filter(cache => cache.i === identifier).length
  }

  public run(spawn: StructureSpawn): GameObjectTaskReturnCode {
    if (spawn.spawning == null) {
      // idle
      this.spawning = null
      return this.spawn(spawn)

    } else {
      // spawning
      const nextSpawn = this.spawnCache[0]
      if (nextSpawn == null || nextSpawn.p !== spawnPriorityUrgent) {
        return "in progress"
      }
      if (this.canCancelCurrentSpawning(spawn.spawning) !== true) {
        return "in progress"
      }
      this.cancelCurrentSpawning(spawn.spawning)
      return this.spawn(spawn)
    }
  }

  private spawn(spawn: StructureSpawn): GameObjectTaskReturnCode {
    const nextSpawn = this.spawnCache[0]
    if (nextSpawn == null) {
      return "finished"
    }

    const result = spawn.spawnCreep(nextSpawn.b, nextSpawn.n, { memory: nextSpawn.m })

    switch (result) {
    case OK:
      this.spawning = nextSpawn
      this.spawnCache.shift()
      return "in progress"

    case ERR_NOT_ENOUGH_ENERGY:
      return "in progress"

    case ERR_NAME_EXISTS:
      PrimitiveLogger.fatal(`spawn.spawnCreep() returns ERR_NAME_EXISTS, spawn: ${spawn.name} at ${roomLink(spawn.room.name)}, duplicated name: ${nextSpawn.n}, trying to discard current spawn and retry..`)
      this.spawnCache.shift()
      return "in progress"

    case ERR_BUSY:
      PrimitiveLogger.log(`spawn.spawnCreep() returns ERR_BUSY possibly programming bug (spawn: ${spawn.name})`)
      return "in progress"

    case ERR_INVALID_ARGS:
      PrimitiveLogger.log(`spawn.spawnCreep() returns ERR_INVALID_ARGS possibly programming bug (spawn: ${spawn.name}, creep name: ${nextSpawn.n}, body: ${nextSpawn.b}), trying to discard current spawn and retry..`)
      this.spawnCache.shift()
      return "in progress"

    case ERR_NOT_OWNER:
      return "failed"

    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.fatal(`spawn.spawnCreep() returns ERR_RCL_NOT_ENOUGH, spawn: ${spawn.name} at ${roomLink(spawn.room.name)}`)
      return "failed"

    default:
      PrimitiveLogger.fatal(`spawn.spawnCreep() returns unexpected return code ${result}, spawn: ${spawn.name} at ${roomLink(spawn.room.name)}, trying to discard current spawn and retry..`)
      this.spawnCache.shift()
      return "in progress"
    }
  }

  private canCancelCurrentSpawning(spawning: Spawning): boolean {
    const isAlmostDone = spawning.remainingTime < 20 || (spawning.remainingTime / spawning.needTime) < 0.2
    if (isAlmostDone) {
      return false
    }
    if (this.spawning == null) {
      return true
    }
    if (this.spawning.p < spawnPriorityHigh) {
      return true
    }
    return false
  }

  private cancelCurrentSpawning(spawning: Spawning): void {
    // TODO: cancelを通知する or 呼び出し側でcacheLengthOf()等を使用して確認する
    PrimitiveLogger.log(`${spawning.spawn.name} canceled spawn ${spawning.name}`)
    spawning.cancel()
    this.spawning = null
  }
}
