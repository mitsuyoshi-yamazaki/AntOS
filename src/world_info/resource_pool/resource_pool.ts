import { isV5CreepMemory } from "prototype/creep"
import { RoomName } from "prototype/room"
import { CreepPool, CreepPoolAssignPriority, CreepPoolFilter, CreepPoolTaskBuilder } from "./creep_resource_pool"
import { CreepSpawnRequest } from "./creep_specs"
import { SpawnPool } from "./spawn_resource_pool"
import { TowerPool, TowerTask } from "./tower_resource_pool"
// Worldをimportしない

type ResourcePoolIdentifier = string

export interface ResourcePoolType<T> {
  parentRoomName: RoomName

  addResource(resource: T): void
}

const creepResourcePools = new Map<ResourcePoolIdentifier, CreepPool>()
const towerResourcePools = new Map<ResourcePoolIdentifier, TowerPool>()
const spawnResourcePools = new Map<ResourcePoolIdentifier, SpawnPool>()
const spawnCreepRequests = new Map<ResourcePoolIdentifier, CreepSpawnRequest[]>()

export interface ResourcePoolsInterface {
  // ---- Lifecycle ---- //
  beforeTick(allCreeps: Map<RoomName, Creep[]>, allTowers: Map<RoomName, StructureTower[]>, allSpawns: StructureSpawn[]): void
  afterTick(): void

  // ---- Creep ---- //
  checkCreeps(roomName: RoomName, filter: CreepPoolFilter): number
  assignTasks(roomName: RoomName, priority: CreepPoolAssignPriority, taskBuilder: CreepPoolTaskBuilder, filter: CreepPoolFilter): void

  // ---- Tower ---- //
  addTowerTask(roomName: RoomName, task: TowerTask): void

  /** 毎tick呼び出す */
  addSpawnCreepRequest(roomName: RoomName, request: CreepSpawnRequest): void
}

/**
 * - Creep, Spawn, Observerなど、継続的に利用するリソースを管理する
 *   - Lab（boost用）など単発利用のものは要検討
 * - creep resource pool
 *   - ひとつのcreepが複数のpoolに登録される場合もある
 */
export const ResourcePools: ResourcePoolsInterface = {
  // ---- Lifecycle ---- //
  beforeTick: (allCreeps: Map<RoomName, Creep[]>, allTowers: Map<RoomName, StructureTower[]>, allSpawns: StructureSpawn[]): void => {
    reloadCreepResourcePools(allCreeps)
    reloadTowerResourcePools(allTowers)
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

    towerResourcePools.forEach(pool => {
      pool.executeTask()
    })
  },

  // ---- Creep ---- //
  checkCreeps: function(roomName: RoomName, filter: CreepPoolFilter): number {
    const pool = getCreepPool(roomName)
    if (pool == null) { // TODO: CreepPoolがない場合はspawn時に生成する
      return 0
    }
    return pool.checkCreeps(filter)
  },

  assignTasks: function(roomName: RoomName, priority: CreepPoolAssignPriority, taskBuilder: CreepPoolTaskBuilder, filter: CreepPoolFilter): void {
    const pool = getCreepPool(roomName)
    if (pool == null) {
      return
    }
    pool.assignTasks(priority, taskBuilder, filter)
    return
  },

  addSpawnCreepRequest: function(roomName: RoomName, request: CreepSpawnRequest): void {
    const reqeusts = ((): CreepSpawnRequest[] => {
      const identifier = resourcePoolIdentifier(roomName)
      const stored = spawnCreepRequests.get(identifier)
      if (stored != null) {
        return stored
      }
      const newRequestList: CreepSpawnRequest[] = []
      spawnCreepRequests.set(identifier, newRequestList)
      return newRequestList
    })()

    reqeusts.push(request)
  },

  // ---- Tower ---- //
  addTowerTask: function (roomName: RoomName, task: TowerTask): void {
    const pool = towerResourcePools.get(resourcePoolIdentifier(roomName))
    if (pool == null) {
      return
    }
    pool.addTask(task)
    return
  },
}


// ---- Functions ---- //
function resourcePoolIdentifier(parentRoomName: RoomName): ResourcePoolIdentifier {
  return `${parentRoomName}`
}

function reloadCreepResourcePools(allCreeps: Map<RoomName, Creep[]>): void {
  creepResourcePools.clear()

  allCreeps.forEach((creeps, parentRoomName) => { // TODO: 単純にRoomNameからresource pool作れる気がする
    creeps.forEach(creep => {
      if (!isV5CreepMemory(creep.memory)) {
        return
      }
      const pool = ((): CreepPool => {
        const identifier = resourcePoolIdentifier(parentRoomName)
        const stored = creepResourcePools.get(identifier)
        if (stored != null) {
          return stored
        }
        const newPool = new CreepPool(parentRoomName)
        creepResourcePools.set(identifier, newPool)
        return newPool
      })()

      pool.addResource(creep)
    })
  })
}

function reloadTowerResourcePools(allTowers: Map<RoomName, StructureTower[]>): void {
  towerResourcePools.clear()

  allTowers.forEach((towers, parentRoomName) => {
    const pool = new TowerPool(parentRoomName)
    towers.forEach(tower => pool.addResource(tower))
    towerResourcePools.set(parentRoomName, pool)
  })
}

function reloadSpawnResourcePools(allSpawns: StructureSpawn[]): void {
  spawnResourcePools.clear()
  spawnCreepRequests.clear()

  allSpawns.forEach(spawn => {
    const pool = ((): SpawnPool => {
      const identifier = resourcePoolIdentifier(spawn.room.name)
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

function getCreepPool(parentRoomName: RoomName): CreepPool | null {
  const poolIdentifier = resourcePoolIdentifier(parentRoomName)
  return creepResourcePools.get(poolIdentifier) ?? null
}
