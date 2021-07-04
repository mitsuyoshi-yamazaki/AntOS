import { Creeps, CreepsInterface } from "./creep_info"
import { ResourcePools, ResourcePoolsInterface } from "./resource_pool/resource_pool"
import { Rooms, RoomsInterface } from "./room_info"
import { Spawns, SpawnsInterface } from "./spawn_info"

interface WorldInterface {
  isSimulation(): boolean

  creeps: CreepsInterface
  spawns: SpawnsInterface
  rooms: RoomsInterface
  resourcePools: ResourcePoolsInterface

  // ---- Lifecycle ---- //
  beforeTick(): void
  afterTick(): void
}

/**
 * - "現在の情報"（PhysicalGameObjectなど）と"キャッシュ"（RoomPositionなど）と"継続した観察結果"がある
 */
export const World: WorldInterface = {
  isSimulation: function (): boolean {
    return Game.shard.name === "sim"
  },

  creeps: Creeps,
  spawns: Spawns,
  rooms: Rooms,
  resourcePools: ResourcePools,

  beforeTick: function (): void {
    // 呼び出し順序に注意: 基本的に低次の処理から呼び出す
    const allCreeps = this.creeps.beforeTick()
    const allSpawns = this.spawns.beforeTick()
    this.rooms.beforeTick(allCreeps)
    this.resourcePools.beforeTick(allCreeps, allSpawns)
  },

  afterTick: function (): void {
    this.resourcePools.afterTick()
    this.rooms.afterTick()
    this.spawns.afterTick()
    this.creeps.afterTick()
  },
}
