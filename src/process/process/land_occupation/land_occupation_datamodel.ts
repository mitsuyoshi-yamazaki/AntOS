/**
 # RoomModel
 ## 概要
 Structureを必要な形で扱える情報

 ## 役割
 - 内部的なデータ構造は矛盾（の可能性）を許容する
 - あくまで外部利用が無矛盾で行えればそれで良い
 - 生データはMemoryに格納, ConstructionSiteなどの二次的データはheapに展開

 ## 要件
 - Structureを取得できること
 - ConstructionSiteを取得できること
 - ConstructionSite設置箇所を取得できること

 ## 永続化
 - Memory: 何を建設するかを格納する
 - heap: Structure IDと状態
 - tick: Structureオブジェクト

 ## 想定される挙動
 - Spawnがない場合は近隣から派遣されたworkerが建築・upgradeを行う
 - Spawnがある場合はharvester, upgrader, haulerをspawnさせる
   - harvesterは面倒がないようにrenewを使う
 - ConstructionSite
   - workerはひとつずつ
   - clusterがある場合はそれぞれ

 ## Discussion
 - 最終的にrepairやbuildする対象はひとつ→それはそう
   - それはそれとして、そのひとつを決定するには全体の情報を取得する必要がある
 */

import { decodeRoomPosition } from "prototype/room_position"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { Position } from "shared/utility/position"
import { Result } from "shared/utility/result"
import type { RoomName } from "shared/utility/room_name_types"
import type { Timestamp } from "shared/utility/timestamp"
import { ValuedArrayMap } from "shared/utility/valued_collection"

export type SerializedPosition = string

export type LandOccupationStructureTypes = STRUCTURE_SPAWN
  | STRUCTURE_TOWER
  | STRUCTURE_CONTAINER

type LandOccupationStructures = StructureSpawn
  | StructureTower
  | StructureContainer

type ChargeableStructures = StructureSpawn
  | StructureTower
  | StructureContainer

type BuildableWalls = StructureRampart | StructureWall
export type BuildableWallTypes = STRUCTURE_RAMPART | STRUCTURE_WALL

// type StructureStateUnconstructed<T extends LandOccupationStructureTypes> = {
//   readonly case: "unconstructed"
//   readonly structureType: T
// }
// type StructureStateConstructingRampart<T extends LandOccupationStructureTypes> = {
//   readonly case: "constructing rampart"
//   readonly structureType: T
//   readonly constructionSiteId: Id<ConstructionSite<STRUCTURE_RAMPART>>
// }
// type StructureStateConstructing<T extends LandOccupationStructureTypes> = {
//   readonly case: "constructing"
//   readonly constructionSiteId: Id<ConstructionSite<T>>
//   readonly rampartId: Id<StructureRampart>
// }
// type StructureStateBuilt<T extends LandOccupationStructureTypes> = {
//   readonly case: "built"
//   readonly structureId: Id<Structure<T>>
//   readonly rampartId: Id<StructureRampart>
// }
// type StructureState<T extends LandOccupationStructureTypes> = StructureStateUnconstructed<T>
//   | StructureStateConstructingRampart<T>
//   | StructureStateConstructing<T>
//   | StructureStateBuilt<T>

// type PositionState<T extends LandOccupationStructureTypes> = {
//   readonly position: Position
//   readonly structure: StructureState<T>
// }

// type WallStateUnconstructed<T extends BuildableWallTypes> = {
//   readonly case: "unconstructed"
//   readonly structureType: T
// }
// type WallStateConstructing<T extends BuildableWallTypes> = {
//   readonly case: "constructing"
//   readonly constructionSiteId: Id<ConstructionSite<T>>
// }
// type WallStateBuilt<T extends BuildableWallTypes> = {
//   readonly case: "built"
//   readonly structureId: Id<Structure<T>>
// }
// type WallState<T extends BuildableWallTypes> = WallStateUnconstructed<T>
//   | WallStateConstructing<T>
//   | WallStateBuilt<T>

// type WallPositionState<T extends BuildableWallTypes> = {
//   readonly position: Position
//   readonly structure: WallState<T>
// }

type PositionState = {
  position: Position
  rampartId: Id<StructureRampart> | null
}
type WallState = {
  position: Position
  wallId: Id<StructureWall> | null
}
type StructureState<T extends LandOccupationStructures> = {
  position: Position
  structureId: Id<T> | null
  rampartId: Id<StructureRampart> | null
}

export type ClusterIdentifier = string
export type ClusterPlan = {
  readonly center: Position
  readonly plan: { [SerializedPosition: string]: LandOccupationStructureTypes | BuildableWallTypes }
}

type Construction = {
  readonly position: Position
  readonly structureType: LandOccupationStructureTypes | BuildableWallTypes
}

type StructureCluster = {
  positions: PositionState[]
  walls: WallState[]
  structures: StructureState<LandOccupationStructures>[]
}

type StructureData<T extends StructureConstant> = {
  readonly type: T
  readonly id: Id<ConcreteStructure<T>> | null
  readonly position: RoomPosition
}
export type ClusterStaticData = {
  readonly updatedAt: Timestamp
  readonly structures: StructureData<StructureConstant>[]
  readonly constructionSite: Id<ConstructionSite<BuildableStructureConstant>> | null
  readonly nextConstructions: Construction[]
}

/**
 * 1tick以上生存しない
 */
export type ClusterData = {
  readonly centerPosition: RoomPosition
  readonly structures: Partial<{ [K in StructureConstant]: ConcreteStructure<K>[] }>
  readonly constructionSite: ConstructionSite<BuildableStructureConstant> | null
}

export const fetchClusterData = (controller: StructureController, cluster: ClusterPlan): [ClusterData, ClusterStaticData] => {
  const centerPosition = decodeRoomPosition(cluster.center, controller.room.name)
  const structures: Partial<{ [K in StructureConstant]: ConcreteStructure<K>[] }> = {}
  const staticStructures: StructureData<StructureConstant>[] = []

  const constructedStructures = new Map<SerializedPosition, StructureConstant>()
  const constructedRamparts = new Map<SerializedPosition, boolean>()

  const addStructure = <T extends StructureConstant>(structure: ConcreteStructure<T>): void => {
    if (structures[structure.structureType] == null) {
      structures[structure.structureType] = []
    }
    (structures[structure.structureType] as ConcreteStructure<T>[]).push(structure)
  }

  centerPosition.findInRange(FIND_STRUCTURES, 1).forEach(structure => {
    addStructure(structure)
    staticStructures.push({
      type: structure.structureType,
      id: structure.id,
      position: structure.pos,
    })

    const serializedPosition = serializePosition(structure.pos)
    if (structure.structureType === STRUCTURE_RAMPART) {
      constructedRamparts.set(serializedPosition, true)
    } else {
      constructedStructures.set(serializedPosition, structure.structureType)
    }
  })

  const nextConstructions: Construction[] = []

  const constructionSite = centerPosition.findInRange(FIND_MY_CONSTRUCTION_SITES, 1)[0] ?? null
  if (constructionSite != null) {
    const serializedPosition = serializePosition(constructionSite.pos)
    if (constructionSite.structureType === STRUCTURE_RAMPART) {
      constructedRamparts.set(serializedPosition, true)
    } else {
      constructedStructures.set(serializedPosition, constructionSite.structureType)
    }
  }

  const canConstruct = controller.level >= 3
  if (canConstruct === true) {
    nextConstructions.push(...Array.from(Object.entries(cluster.plan)).flatMap(([serializedPosition, structureType]): Construction[] => {
      if (structureType === STRUCTURE_WALL) {
        if (constructedStructures.get(serializedPosition) === structureType) {
          return []
        }
        return [{
          position: deserializePosition(serializedPosition),
          structureType,
        }]
      } else {
        const missingConstructions: Construction[] = []
        if (constructedStructures.get(serializedPosition) !== structureType) {
          missingConstructions.push({
            position: deserializePosition(serializedPosition),
            structureType,
          })
        }
        if (constructedRamparts.has(serializedPosition) !== true) {
          missingConstructions.push({
            position: deserializePosition(serializedPosition),
            structureType: STRUCTURE_RAMPART,
          })
        }
        return missingConstructions
      }
    }))
  }

  const clusterData: ClusterData = {
    centerPosition,
    structures,
    constructionSite,
  }

  const clusterStaticData: ClusterStaticData = {
    updatedAt: Game.time,
    structures: staticStructures,
    constructionSite: constructionSite?.id ?? null,
    nextConstructions,
  }

  return [
    clusterData,
    clusterStaticData,
  ]
}

/**
 * staticDataにも更新が入る
 */
// export const retrieveClusterData = (staticData: ClusterStaticData): ClusterData => {
// }

/**
 * 1tick以上生存しない
 * IDをキャッシュする場合はClusterGameDataを用いる
 */
// export class ClusterModel {
//   private readonly centerPosition: RoomPosition
//   private readonly structures: Partial<{ [K in StructureConstant]: ConcreteStructure<K>[] }> = {}
//   private readonly constructionSite: ConstructionSite<BuildableStructureConstant> | null
//   private readonly nextConstruction: Construction | null

//   public constructor(
//     /** Memoryに格納されているオブジェクトの参照 */
//     public readonly cluster: ClusterPlan,
//     controller: StructureController,
//     cachedGameData: ClusterGameData | null,
//   ) {
//     this.centerPosition = decodeRoomPosition(cluster.center, controller.room.name)

//     this.centerPosition.findInRange(FIND_STRUCTURES, 1).forEach(structure => {
//       this.addStructure(structure)
//     })

//     this.constructionSite = this.centerPosition.findInRange(FIND_MY_CONSTRUCTION_SITES, 1)[0] ?? null

//     const canConstruct = controller.level >= 3
//     if (canConstruct === true) {

//     }
//   }

//   private addStructure<T extends StructureConstant>(structure: ConcreteStructure<T>): void {
//     if (this.structures[structure.structureType] == null) {
//       this.structures[structure.structureType] = []
//     }
//     (this.structures[structure.structureType] as ConcreteStructure<T>[]).push(structure)
//   }

//   public getStructures<T extends BuildableStructureConstant>(structureType: T): ConcreteStructure<T>[] {
//     return this.structures[structureType] ?? []
//   }

//   public getConstructionSite(): ConstructionSite<BuildableStructureConstant> | null {
//     return this.constructionSite
//   }

//   public getNextConstruction(): Construction | null {
//     return this.nextConstruction
//   }
// }

// export class MainSourceClusterModel extends ClusterModel {
//   public getSpawn(): StructureSpawn | null {
//     return this.getStructures(STRUCTURE_SPAWN)[0] ?? null
//   }

//   public getTowers(): StructureTower[] {
//     return this.getStructures(STRUCTURE_TOWER)
//   }

//   public getContainer(): StructureContainer | null {
//     return this.getStructures(STRUCTURE_CONTAINER)[0] ?? null
//   }

//   public getRamparts(): StructureRampart[] {
//     return this.getStructures(STRUCTURE_RAMPART)
//   }
// }

// export class ControllerClusterModel extends ClusterModel {
//   public getContainer(): StructureContainer | null {
//     return this.getStructures(STRUCTURE_CONTAINER)[0] ?? null
//   }

//   public getRamparts(): StructureRampart[] {
//     return this.getStructures(STRUCTURE_RAMPART)
//   }
// }

// export class RoomModel {
//   private readonly positionInfo = new Map<SerializedPosition, { clusterIdentifier: ClusterIdentifier, structureType: LandOccupationStructureTypes | BuildableWallTypes }>()
//   private readonly clusterPositions = new Map<ClusterIdentifier, Position>()

//   private gameIds: {
//     readonly level: number
//     readonly roomName: RoomName
//     readonly buildingConstructionSites: Map<ClusterIdentifier, Id<ConstructionSite<BuildableStructureConstant>>>
//     readonly chargeableStructures: ValuedArrayMap<ClusterIdentifier, Id<ChargeableStructures>>
//     readonly structures: ValuedArrayMap<LandOccupationStructureTypes, Id<Structure<LandOccupationStructureTypes>>>
//     readonly constructionQueue: {position: Position, structureType: LandOccupationStructureTypes | BuildableWallTypes}[]
//   }
//   private gameObjects: {
//     readonly time: Timestamp
//     readonly room: Room
//     buildingConstructionSites: Map<ClusterIdentifier, ConstructionSite<BuildableStructureConstant>> | null
//     chargeableStructures: Map<ClusterIdentifier, ChargeableStructures> | null
//     structures: ValuedArrayMap<LandOccupationStructureTypes, Structure<LandOccupationStructureTypes>> | null
//   }

//   public constructor(
//     /** Memoryに格納されているオブジェクトの参照 */
//     public readonly clusterPlans: { [Identifier: string]: ClusterPlan },
//     controller: StructureController,
//   ) {
//     const room = controller.room

//     Array.from(Object.entries(clusterPlans)).forEach(([identifier, plan]) => {
//       this.clusterPositions.set(identifier, plan.position)

//       Array.from(Object.entries(plan.plan)).forEach(([serializedPosition, structureType]) => {
//         this.positionInfo.set(
//           serializedPosition,
//           {
//             clusterIdentifier: identifier,
//             structureType,
//           },
//         )
//       })
//     })

//     const buildingConstructionSiteIds = new Map<ClusterIdentifier, Id<ConstructionSite<BuildableStructureConstant>>>()
//     const buildingConstructionSites = new Map<ClusterIdentifier, ConstructionSite<BuildableStructureConstant>>()

//     room.find(FIND_MY_CONSTRUCTION_SITES).forEach(constructionSite => {
//       const serializedPosition = serializePosition(constructionSite.pos)
//       const clusterIdentifier = this.positionInfo.get(serializedPosition)?.clusterIdentifier
//       if (clusterIdentifier == null) {
//         return
//       }
//       buildingConstructionSiteIds.set(clusterIdentifier, constructionSite.id)
//       buildingConstructionSites.set(clusterIdentifier, constructionSite)
//     })

//     const chargeableStructureIds = new ValuedArrayMap<ClusterIdentifier, Id<ChargeableStructures>>()
//     const structureIds = new ValuedArrayMap<LandOccupationStructureTypes, Id<Structure<LandOccupationStructureTypes>>>()
//     const structures = new ValuedArrayMap<LandOccupationStructureTypes, Structure<LandOccupationStructureTypes>>()

//     room.find(FIND_STRUCTURES).forEach(structure => {
//       const serializedPosition = serializePosition(structure.pos)
//       const info = this.positionInfo.get(serializedPosition)
//       if (info == null) {
//         return
//       }

//       switch (structure.structureType) {
//       case STRUCTURE_SPAWN:
//         chargeableStructureIds.getValueFor(info.clusterIdentifier).push(structure.id)
//         structureIds.getValueFor(structure.structureType).push(structure.id)
//         structures.getValueFor(structure.structureType).push(structure)
//         break
//       case STRUCTURE_TOWER:
//         chargeableStructureIds.getValueFor(info.clusterIdentifier).push(structure.id)
//         structureIds.getValueFor(structure.structureType).push(structure.id)
//         structures.getValueFor(structure.structureType).push(structure)
//         break
//       case STRUCTURE_CONTAINER:
//         chargeableStructureIds.getValueFor(info.clusterIdentifier).push(structure.id)
//         structureIds.getValueFor(structure.structureType).push(structure.id)
//         structures.getValueFor(structure.structureType).push(structure)
//         break
//       default:
//         break
//       }
//     })

//     this.gameIds = {
//       level: controller.level,
//       roomName: room.name,
//       buildingConstructionSites: buildingConstructionSiteIds,
//       chargeableStructures: chargeableStructureIds,
//       structures: structureIds,
//     }
//     this.gameObjects = {
//       time: Game.time,
//       room,
//       buildingConstructionSites,
//       chargeableStructures: null,
//       structures,
//     }
//   }

//   /**
//    * 現tickの情報に更新
//    */
//   public updateGameObjects(): Result<void, string> {
//     if (this.gameObjects.time === Game.time) {
//       return Result.Succeeded(undefined)
//     }

//     const room = Game.rooms[this.gameIds.roomName]
//     if (room == null) {
//       return Result.Failed("room invisible")
//     }

//     this.gameObjects = {
//       time: Game.time,
//       room,
//       buildingConstructionSites: null,
//       chargeableStructures: null,
//       structures: null,
//     }
//     return Result.Succeeded(undefined)
//   }

//   public getConstructionSite(clusterIdentifier: ClusterIdentifier): ConstructionSite<LandOccupationStructureTypes | BuildableWallTypes> | null {
//     if (this.gameObjects.buildingConstructionSites == null) {

//     }
//     const constructionSite =
//   }

//   public getStructures<T extends LandOccupationStructureTypes>(clusterIdentifier: ClusterIdentifier, structureType: T): ConcreteStructure<T>[] {

//   }

//   public getWallToRepair(clusterIdentifier?: ClusterIdentifier): BuildableWalls | null {

//   }

//   public getChargeableStructure(clusterIdentifier?: ClusterIdentifier): ChargeableStructureTypes | null {
//     if (clusterType == null) {
//       const structure = this.chargeableStructures.get(anyClusterType)
//       if (structure !== undefined) {
//         return structure
//       }

//       const structures = clusterTypes.flatMap((clusterType): ChargeableStructureTypes[] => {
//         const s = this.getChargeableStructure(clusterType)
//         if (s == null) {
//           return []
//         }
//         return [s]
//       })
//       structures.sort((lhs, rhs) => (rhs.store.getCapacity(RESOURCE_ENERGY) - rhs.store.getFreeCapacity(RESOURCE_ENERGY)) - (lhs.store.getCapacity(RESOURCE_ENERGY) - lhs.store.getFreeCapacity(RESOURCE_ENERGY)))
//       const chargeableStructure = structures[0] ?? null
//       this.chargeableStructures.set(anyClusterType, chargeableStructure)

//       return chargeableStructure
//     }

//     const chargeableStructure = this.chargeableStructures.get(clusterType)
//     if (chargeableStructure !== undefined) {
//       return chargeableStructure
//     }

//     const foundStructure = this.findChargeableStructure(clusterType)
//     this.chargeableStructures.set(clusterType, foundStructure)

//     return foundStructure
//   }

//   private findChargeableStructure(clusterType: ClusterType): ChargeableStructureTypes | null {

//   }

//   private updateBuildingConstructionSites
// }


export const serializePosition = (position: Position): SerializedPosition => {
  return `${position.x},${position.y}` as SerializedPosition
}

export const deserializePosition = (serialized: SerializedPosition): Position => {
  const components = (serialized as string).split(",")
  if (components[0] == null || components[1] == null) {
    PrimitiveLogger.programError(`invalid SerializedPosition: ${serialized}`)
    return { x: 25, y: 25 }
  }

  const x = parseInt(components[0], 10)
  const y = parseInt(components[1], 10)
  return { x, y }
}
