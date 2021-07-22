import { TaskRunnerId, TaskTargetCache as V5TaskTargetCache } from "v5_object_task/object_task_target_cache"

export type EnergyChargeableStructure = StructureSpawn | StructureExtension | StructureTower | StructureContainer | StructurePowerSpawn | StructureTerminal  // TODO: まだある

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

declare global {
  interface RoomObject {
    /** @deprecated */
    v5TargetedBy: TaskRunnerId[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(RoomObject.prototype, "v5TargetedBy", {
    get(): TaskRunnerId[] {
      return V5TaskTargetCache.targetingTaskRunnerIds(this.id)
    },
  })
}
