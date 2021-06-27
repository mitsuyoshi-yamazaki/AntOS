import { StructureSpawnTask } from "game_object_task/game_object_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"

declare global {
  interface StructureSpawn {
    task: StructureSpawnTask | null

    /** @deprecated 外部呼び出しを想定していないのでとりあえずdeprecatedにしている */
    _task: StructureSpawnTask | null
  }
}

export function init(): void {
  Object.defineProperty(StructureSpawn.prototype, "task", {
    get(): StructureSpawnTask | null {
      return this._task
    },
    set(task: StructureSpawnTask | null): void {
      if (this._task != null && this._task.targetId != null) {
        TaskTargetCache.didFinishTask(this, this._task.targetId)
      }
      if (task != null && task.targetId != null) {
        TaskTargetCache.didAssignTask(this, task.targetId)
      }
      this._task = task
    }
  })
}
