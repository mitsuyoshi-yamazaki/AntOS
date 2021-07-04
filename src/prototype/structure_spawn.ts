import { StructureSpawnTask } from "game_object_task/spawn_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"

export type SpawnName = string

declare global {
  interface StructureSpawn {
    task: StructureSpawnTask | null

    /** @deprecated 外部呼び出しを想定していないのでとりあえずdeprecatedにしている */
    _task: StructureSpawnTask | null
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(StructureSpawn.prototype, "task", {
    get(): StructureSpawnTask | null {
      return this._task
    },
    set(task: StructureSpawnTask | null): void {
      if (this._task != null && this._task.targetId != null) {
        TaskTargetCache.didFinishTask(this.id, this._task.targetId)
      }
      if (task != null && task.targetId != null) {
        TaskTargetCache.didAssignTask(this.id, task.targetId)
      }
      this._task = task
    }
  })
}
