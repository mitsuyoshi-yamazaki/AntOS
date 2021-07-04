import { CreepRole } from "prototype/creep"
import { RoomName } from "prototype/room"
import { generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"
import { ResourcePoolType } from "./resource_pool"

/** High未満のpriorityのspawnをキャンセルして優先させる */
type SpawnPoolSpawnRequestPriorityUrgent = 0
type SpawnPoolSpawnRequestPriorityHigh = 1
type SpawnPoolSpawnRequestPriorityMedium = 2
type SpawnPoolSpawnRequestPriorityLow = 3

export const spawnPoolSpawnRequestPriorityUrgent: SpawnPoolSpawnRequestPriorityUrgent = 0
export const spawnPoolSpawnRequestPriorityHigh: SpawnPoolSpawnRequestPriorityHigh = 1
export const spawnPoolSpawnRequestPriorityMedium: SpawnPoolSpawnRequestPriorityMedium = 2
export const spawnPoolSpawnRequestPriorityLow: SpawnPoolSpawnRequestPriorityLow = 3

export type SpawnPoolSpawnRequestPriority = SpawnPoolSpawnRequestPriorityUrgent | SpawnPoolSpawnRequestPriorityHigh | SpawnPoolSpawnRequestPriorityMedium | SpawnPoolSpawnRequestPriorityLow

export interface SpawnPoolSpawnRequest {
  priority: SpawnPoolSpawnRequestPriority
  numberOfCreeps: number
  body: BodyPartConstant[]
  codename: string
  roles: CreepRole[]
}

export class SpawnPool implements ResourcePoolType<StructureSpawn> {
  private readonly spawns: StructureSpawn[] = []

  public constructor(
    public readonly parentRoomName: RoomName,
  ) { }

  public addResource(spawn: StructureSpawn): void {
    this.spawns.push(spawn)
  }

  public spawnCreeps(requests: SpawnPoolSpawnRequest[]): void { // TODO: merge可能なものをmergeする
    const idleSpawns = this.spawns.filter(spawn => spawn.spawning == null)
    if (idleSpawns.length <= 0) {
      return
    }
    requests.sort((lhs, rhs): number => {
      if (lhs.priority !== rhs.priority) {
        return lhs.priority < rhs.priority ? -1 : 1
      }
      return lhs.numberOfCreeps > rhs.numberOfCreeps ? -1 : 1 // TODO: body.lengthも考慮して優先度をつける
    })

    idleSpawns.forEach(spawn => {
      const request = requests.shift()
      if (request == null) {
        return
      }
      const creepName = generateUniqueId(request.codename)
      const memory: CreepMemory = {
        ts: null,
        v5: {
          p: this.parentRoomName,
          r: request.roles,
          t: null,
        },
        squad_name: "",
        status: CreepStatus.NONE,
        birth_time: Game.time,
        type: CreepType.TAKE_OVER,
        should_notify_attack: false,
        let_thy_die: true,
      }
      spawn.spawnCreep(request.body, creepName, {memory: memory})
    })
  }

  // spawning中でもメモリはあるため不要のはず
  // /**
  //  *
  //  * @returns 重複あり
  //  */
  // public spawningCreepRoles(): CreepRole[] {
  //   return this.spawns.reduce((result, current) => {
  //     if (current.spawning == null) {
  //       return result
  //     }
  //     const memory = Memory.creeps[current.spawning.name]
  //     if (memory == null) {
  //       PrimitiveLogger.fatal(`[Program bug] spawning creep doesn't have its memory: ${current.spawning.name} in ${roomLink(current.room.name)}`)
  //       return result
  //     }
  //     if (memory.v5 == null) {
  //       return result
  //     }
  //     result.push(...memory.v5.r)
  //     return result
  //   }, [] as CreepRole[])
  // }
}
