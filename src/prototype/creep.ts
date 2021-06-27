import { CreepTask } from "game_object_task/game_object_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"

export type CreepName = string

declare global {
  interface Creep {
    task: CreepTask | null

    /** @deprecated 外部呼び出しを想定していないのでとりあえずdeprecatedにしている */
    _task: CreepTask | null
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(Creep.prototype, "task", {
    get(): CreepTask | null {
      return this._task
    },
    set(task: CreepTask | null): void {
      if (this._task != null && this._task.targetId != null) {
        TaskTargetCache.didFinishTask(this, this._task.targetId)
      }
      if (task != null && task.targetId != null) {
        TaskTargetCache.didAssignTask(this, task.targetId)
      }
      this._task = task
      this.say(task?.shortDescription ?? "idle")
    }
  })
}
