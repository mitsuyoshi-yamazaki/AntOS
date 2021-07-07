import { TaskRunnerId, TaskTargetCache } from "object_task/object_task_target_cache"

export type EnergyChargeableStructure = StructureSpawn | StructureExtension | StructureTower  // TODO: まだある

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
    targetedBy: TaskRunnerId[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  try { // FixMe: Season3環境でなぜか失敗した
    Object.defineProperty(RoomObject.prototype, "targetedBy", {
      get(): TaskRunnerId[] {
        return TaskTargetCache.targetingTaskRunnerIds(this.id)
      },
    })
  } catch (error) {
    console.log(`RoomObject.defineProperty failed in ${Game.shard.name}`)
  }
}
