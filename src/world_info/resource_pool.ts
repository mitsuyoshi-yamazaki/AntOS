import { CreepRole } from "prototype/creep"
import { RoomName } from "prototype/room"
// Worldをimportしない

type ResourcePoolIdentifier = string

function resourcePoolIdentifier(parentRoomName: RoomName, creepRole: CreepRole): ResourcePoolIdentifier {
  return `${parentRoomName}_${creepRole}`
}

const creepResourcePools = new Map<ResourcePoolIdentifier, CreepPool>()

/**
 * - Creep, Spawn, Observerなど、継続的に利用するリソースを管理する
 *   - Lab（boost用）など単発利用のものは要検討
 * - creep resource pool
 *   - ひとつのcreepが複数のpoolに登録される場合もある
 */
export const ResourcePools = {
  getCreepPool: function (parentRoomName: RoomName, creepRole: CreepRole): CreepPool | null {
    const poolIdentifier = resourcePoolIdentifier(parentRoomName, creepRole)
    return creepResourcePools.get(poolIdentifier) ?? null
  },

  beforeTick: function (allCreeps: Creep[]): void {
    creepResourcePools.clear()

    allCreeps.forEach(creep => {
      if (creep.memory.v5 == null) {
        return
      }
      const parentRoomName = creep.memory.v5.p
      creep.memory.v5.r.forEach(role => {
        const identifier = resourcePoolIdentifier(parentRoomName, role)
        const pool = ((): CreepPool => {
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
  },

  afterTick: function (): void {

  },
}

interface ResourcePool<T> {
  parentRoomName: RoomName
  resources: T[]

  addResource(resource: T): void
}

// ---- Creep Pool ---- //
/** タスク実行中でないCreepを返す。いなければ低優先どのCreepの実行中のタスクを破棄して返す。Creepがいなければspawn */
type CreepPoolRequestPriorityUrgent = 0

/** タスク実行中でないCreepを返す。PoolにCreepがいなければspawn */
type CreepPoolRequestPriorityHigh = 1

/** タスク実行中でないCreepを返す。PoolにCreepがいなければ何も返さない */
type CreepPoolRequestPriorityLow = 2

const creepPoolRequestPriorityUrgent: CreepPoolRequestPriorityUrgent = 0
const creepPoolRequestPriorityHigh: CreepPoolRequestPriorityHigh = 1
const creepPoolRequestPriorityLow: CreepPoolRequestPriorityLow = 2

type CreepPoolRequestPriority = CreepPoolRequestPriorityUrgent | CreepPoolRequestPriorityHigh | CreepPoolRequestPriorityLow

interface CreepPoolRequest {
  parentRoomName: RoomName
  role: CreepRole
  priority: CreepPoolRequestPriority

  filter: (creep: Creep) => boolean
}

class CreepPool implements ResourcePool<Creep> {
  public readonly resources: Creep[] = []

  public constructor(
    public readonly parentRoomName: RoomName,
    public readonly role: CreepRole,
  ){}

  public addResource(creep: Creep): void {
    this.resources.push(creep)
  }

  public getCreepsFor(request: CreepPoolRequest): Creep[] {

  }
}
