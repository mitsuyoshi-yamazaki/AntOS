import { TaskRunnerType } from "game_object_task/game_object_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"

export type EnergyChargeableStructure = StructureSpawn | StructureExtension | StructureTower  // TODO: まだある

declare global {
  interface RoomObject {
    targetedBy: Id<TaskRunnerType>[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(RoomObject.prototype, "targetedBy", {
    get(): Id<TaskRunnerType>[] {
      return TaskTargetCache.targetingTaskRunnerIds(this.id)
    },
  })
}
