import { TaskRunnerInfo, TaskTargetCache, TaskTargetCacheTaskType } from "object_task/object_task_target_cache"

export type PowerCreepName = string

declare global {
  interface PowerCreep {
    targetedBy(taskType: TaskTargetCacheTaskType): TaskRunnerInfo[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  PowerCreep.prototype.targetedBy = function (taskType: TaskTargetCacheTaskType): TaskRunnerInfo[] {
    return TaskTargetCache.creepTargetingTaskRunnerInfo(this.id, taskType)
  }
}
