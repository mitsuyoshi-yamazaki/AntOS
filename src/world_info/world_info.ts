import { EnergyChargeableStructure } from "prototype/room_object"
import { Creeps } from "./creep_info"
import { ResourcePools } from "./resource_pool"
import { Rooms } from "./room_info"

export interface OwnedRoomObjects {
  controller: StructureController
  idleCreeps: Creep[]
  sources: Source[]
  constructionSites: ConstructionSite<BuildableStructureConstant>[] // TODO: 優先順位づけ等
  activeStructures: {
    spawns: StructureSpawn[]
    extensions: StructureExtension[]
    towers: StructureTower[]

    damagedStructures: AnyOwnedStructure[]
    chargeableStructures: EnergyChargeableStructure[]
  }
  hostiles: {
    creeps: Creep[]
    powerCreeps: PowerCreep[]
  }
  alliances: {
    creeps: Creep[]
    powerCreeps: PowerCreep[]
  }
  resources: Resource[]
  flags: Flag[]
}

/**
 * - "現在の情報"（PhysicalGameObjectなど）と"キャッシュ"（RoomPositionなど）と"継続した観察結果"がある
 */
export const World = {
  creeps: Creeps,
  rooms: Rooms,
  resourcePools: ResourcePools,

  beforeTick: function (): void {
    // 呼び出し順序に注意: 基本的に低次の処理から呼び出す
    const allCreeps = this.creeps.beforeTick()
    this.resourcePools.beforeTick(allCreeps)
  },

  afterTick: function (): void {
    this.resourcePools.afterTick()
    this.creeps.afterTick()
  },
}
