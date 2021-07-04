import { CreepRole } from "prototype/creep"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { CreepPool, CreepPoolAssignPriority, CreepPoolFilter, CreepPoolTaskBuilder } from "./creep_resource_pool"
import { SpawnPool, SpawnPoolSpawnRequest } from "./spawn_resource_pool"
// Worldをimportしない

type ResourcePoolIdentifier = string

export interface ResourcePoolType<T> {
  parentRoomName: RoomName

  addResource(resource: T): void
}

const creepResourcePools = new Map<ResourcePoolIdentifier, CreepPool>()
const spawnResourcePools = new Map<ResourcePoolIdentifier, SpawnPool>()
const spawnCreepRequests = new Map<ResourcePoolIdentifier, SpawnPoolSpawnRequest[]>()

export interface ResourcePoolsInterface {
  // ---- Lifecycle ---- //
  beforeTick(allCreeps: Map<RoomName, Creep[]>, allSpawns: StructureSpawn[]): void
  afterTick(): void

  // ---- Creep ---- //
  checkCreeps(roomName: RoomName, creepRole: CreepRole, filter: CreepPoolFilter): number
  assignTasks(roomName: RoomName, creepRole: CreepRole, priority: CreepPoolAssignPriority, taskBuilder: CreepPoolTaskBuilder, filter: CreepPoolFilter): void

  /** 毎tick呼び出す */
  addSpawnCreepRequest(roomName: RoomName, request: SpawnPoolSpawnRequest): void
}

/**
 * - Creep, Spawn, Observerなど、継続的に利用するリソースを管理する
 *   - Lab（boost用）など単発利用のものは要検討
 * - creep resource pool
 *   - ひとつのcreepが複数のpoolに登録される場合もある
 */
export const ResourcePools: ResourcePoolsInterface = {
  // ---- Lifecycle ---- //
  beforeTick: (allCreeps: Map<RoomName, Creep[]>, allSpawns: StructureSpawn[]): void => {
    reloadCreepResourcePools(allCreeps)
    reloadSpawnResourcePools(allSpawns)
  },

  afterTick: function (): void {
    creepResourcePools.forEach(pool => {
      pool.executeTask()
    })

    spawnResourcePools.forEach((pool, identifier): void => {
      const requests = spawnCreepRequests.get(identifier)
      if (requests == null) {
        return
      }
      pool.spawnCreeps(requests)
    })
  },

  // ---- Creep ---- //
  checkCreeps: function(roomName: RoomName, creepRole: CreepRole, filter: CreepPoolFilter): number {
    const pool = getCreepPool(roomName, creepRole)
    if (pool == null) { // TODO: CreepPoolがない場合はspawn時に生成する
      return 0
    }
    return pool.checkCreeps(filter)
  },

  assignTasks: function(roomName: RoomName, creepRole: CreepRole, priority: CreepPoolAssignPriority, taskBuilder: CreepPoolTaskBuilder, filter: CreepPoolFilter): void {
    const pool = getCreepPool(roomName, creepRole)
    if (pool == null) {
      return
    }
    pool.assignTasks(priority, taskBuilder, filter)
    return
  },

  addSpawnCreepRequest: function(roomName: RoomName, request: SpawnPoolSpawnRequest): void {
    const reqeusts = ((): SpawnPoolSpawnRequest[] => {
      const identifier = spawnResourcePoolIdentifier(roomName)
      const stored = spawnCreepRequests.get(identifier)
      if (stored != null) {
        return stored
      }
      const newRequestList: SpawnPoolSpawnRequest[] = []
      spawnCreepRequests.set(identifier, newRequestList)
      return newRequestList
    })()

    reqeusts.push(request)
  },
}


// ---- Functions ---- //
function creepResourcePoolIdentifier(parentRoomName: RoomName, creepRole: CreepRole): ResourcePoolIdentifier {
  return `${parentRoomName}_${creepRole}`
}

function spawnResourcePoolIdentifier(parentRoomName: RoomName): ResourcePoolIdentifier {
  return parentRoomName
}

function reloadCreepResourcePools(allCreeps: Map<RoomName, Creep[]>): void {
  creepResourcePools.clear()

  allCreeps.forEach((creeps, parentRoomName) => {
    creeps.forEach(creep => {
      if (creep.memory.v5 == null) {
        return
      }
      creep.memory.v5.r.forEach(role => {
        const pool = ((): CreepPool => {
          const identifier = creepResourcePoolIdentifier(parentRoomName, role)
          const stored = creepResourcePools.get(identifier)
          if (stored != null) {
            return stored
          }
          const newPool = new CreepPool(parentRoomName, role)
          creepResourcePools.set(identifier, newPool)
          return newPool
        })()

        pool.addResource(creep)
      })
    })
  })
}

function reloadSpawnResourcePools(allSpawns: StructureSpawn[]): void {
  spawnResourcePools.clear()
  spawnCreepRequests.clear()

  allSpawns.forEach(spawn => {
    const pool = ((): SpawnPool => {
      const identifier = spawnResourcePoolIdentifier(spawn.room.name)
      const stored = spawnResourcePools.get(identifier)
      if (stored != null) {
        return stored
      }
      const newPool = new SpawnPool(spawn.room.name)
      spawnResourcePools.set(identifier, newPool)
      return newPool
    })()

    pool.addResource(spawn)
  })
}

function getCreepPool(parentRoomName: RoomName, creepRole: CreepRole): CreepPool | null {
  const poolIdentifier = creepResourcePoolIdentifier(parentRoomName, creepRole)
  return creepResourcePools.get(poolIdentifier) ?? null
}
