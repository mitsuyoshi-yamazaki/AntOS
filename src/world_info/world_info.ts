import type { RoomName } from "shared/utility/room_name_types"
import { Creeps, CreepsInterface } from "./creep_info"
import { RoomMap, RoomMapInterface } from "./room_map_info"
import { ResourcePools, ResourcePoolsInterface } from "./resource_pool/resource_pool"
import { Rooms, RoomsInterface } from "./room_info"
import { Spawns, SpawnsInterface } from "./spawn_info"

interface WorldInterface {
  isSimulation(): boolean

  creeps: CreepsInterface
  spawns: SpawnsInterface
  rooms: RoomsInterface
  resourcePools: ResourcePoolsInterface
  map: RoomMapInterface

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
  map: RoomMap,

  beforeTick: function (): void {
    // 呼び出し順序に注意: 基本的に低次の処理から呼び出す
    const allCreeps = this.creeps.beforeTick()
    const allSpawns = this.spawns.beforeTick()
    const ownedRoomObjects = this.rooms.beforeTick()
    const allTowers = new Map<RoomName, StructureTower[]>()
    ownedRoomObjects.forEach(objects => allTowers.set(objects.controller.room.name, objects.activeStructures.towers))
    this.resourcePools.beforeTick(allCreeps, allTowers, allSpawns)
  },

  afterTick: function (): void {
    this.resourcePools.afterTick()
    this.rooms.afterTick()
    this.spawns.afterTick()
    this.creeps.afterTick()
  },
}
