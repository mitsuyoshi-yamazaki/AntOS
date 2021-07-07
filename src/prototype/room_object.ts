import { TaskRunnerType } from "game_object_task/game_object_task"
import { TaskTargetCache } from "object_task/object_task_target_cache"

export type EnergyChargeableStructure = StructureSpawn | StructureExtension | StructureTower  // TODO: まだある

/** Energyを引き出せるオブジェクト */
export type EnergyStore = Tombstone | Resource | StructureContainer | StructureStorage | StructureTerminal | Creep

/** EnergyをStorageへ回収する対象のオブジェクト */
export type EnergySource = Tombstone | Resource | StructureContainer


declare global {
  interface RoomObject {
    targetedBy: Id<TaskRunnerType>[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  try { // FixMe: Season3環境でなぜか失敗した
    Object.defineProperty(RoomObject.prototype, "targetedBy", {
      get(): Id<TaskRunnerType>[] {
        return TaskTargetCache.targetingTaskRunnerIds(this.id)
      },
    })
  } catch (error) {
    console.log(`RoomObject.defineProperty failed in ${Game.shard.name}`)
  }
}
