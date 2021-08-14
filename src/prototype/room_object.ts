import { TaskRunnerId as V5TaskRunnerId, TaskTargetCache as V5TaskTargetCache } from "v5_object_task/object_task_target_cache"

export type EnergyChargeableStructure = StructureSpawn
  | StructureExtension
  | StructureTower
  | StructureContainer
  | StructurePowerSpawn
  | StructureTerminal
  | StructureLab  // TODO: まだある
  | StructureNuker

/** Energyを引き出せるオブジェクト */
export type EnergyStore = Tombstone | Resource | StructureContainer | StructureStorage | StructureTerminal | Creep

/** EnergyをStorageへ回収する対象のオブジェクト */
export type EnergySource = Tombstone | Resource | StructureContainer

export function getEnergyAmountOf(energySource: EnergySource): number {
  if (energySource instanceof Resource) {
    if (energySource.resourceType !== RESOURCE_ENERGY) {
      return 0
    }
    return energySource.amount
  }
  return energySource.store.getUsedCapacity(RESOURCE_ENERGY)
}

export function getResourceAmountOf(obj: Ruin | Resource | Tombstone, resourceType: ResourceConstant): number {
  if (obj instanceof Resource) {
    if (obj.resourceType !== resourceType) {
      return 0
    }
    return obj.amount
  }
  return obj.store.getUsedCapacity(resourceType)
}

declare global {
  interface RoomObject {
    /** @deprecated */
    v5TargetedBy: V5TaskRunnerId[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(RoomObject.prototype, "v5TargetedBy", {
    get(): V5TaskRunnerId[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (this as any).id // FlagにはIDがない
      if (id == null) {
        return []
      }
      return V5TaskTargetCache.targetingTaskRunnerIds(id)
    },
  })
}

export function parseId<T>(id: Id<T> | null): T | null {
  if (id == null) {
    return null
  }
  return Game.getObjectById(id)
}

/**
 * - parse IDs and remove inexist IDs from argument array
 */
export function parseIds<T>(ids: Id<T>[]): T[] {
  const removeIndexes: number[] = []
  const result = ids.flatMap((id, index) => {
    const obj = Game.getObjectById(id)
    if (obj == null) {
      removeIndexes.push(index)
      return []
    }
    return obj
  })
  removeIndexes.reverse()
  removeIndexes.forEach(index => ids.splice(index, 1))
  return result
}
