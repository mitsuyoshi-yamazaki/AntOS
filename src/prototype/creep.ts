import { CreepTask } from "game_object_task/creep_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"

export type CreepName = string

export type CreepRoleHarvester = "harvester"
export type CreepRoleHauler = "hauler"
export type CreepRoleWorker = "worker"
export type CreepRoleScout = "scout"

export const creepRoleHarvester: CreepRoleHarvester = "harvester"
export const creepRoleHauler: CreepRoleHauler = "hauler"
export const creepRoleWorker: CreepRoleWorker = "worker"
export const creepRoleScout: CreepRoleScout = "scout"

export type CreepRole = CreepRoleHarvester | CreepRoleHauler | CreepRoleWorker | CreepRoleScout

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
        TaskTargetCache.didFinishTask(this.id, this._task.targetId)
      }
      if (task != null && task.targetId != null) {
        TaskTargetCache.didAssignTask(this.id, task.targetId)
      }
      this._task = task
      this.say(task?.shortDescription ?? "idle")
    }
  })
}
