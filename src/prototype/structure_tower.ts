import { TaskTargetCache } from "task/object_task_target_cache"
import { StructureTowerTask, StructureTowerTaskState } from "game_object_task/tower_task"

declare global {
  interface StructureTower {
    task: StructureTowerTask | null

    /** @deprecated 外部呼び出しを想定していないのでとりあえずdeprecatedにしている */
    _task: StructureTowerTask | null
  }

  interface TowerMemory {
    ts: StructureTowerTaskState | null
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(StructureTower.prototype, "task", {
    get(): StructureTowerTask | null {
      return this._task
    },
    set(task: StructureTowerTask | null): void {
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
