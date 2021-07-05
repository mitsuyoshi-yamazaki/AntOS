import { TaskRunnerType } from "game_object_task/game_object_task"
import { TaskTargetCache } from "task/task_target_cache"

export type EnergyChargeableStructure = StructureSpawn | StructureExtension | StructureTower  // TODO: まだある
export type EnergyStore = Tombstone | Resource | StructureContainer | StructureStorage | StructureTerminal | Creep

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
