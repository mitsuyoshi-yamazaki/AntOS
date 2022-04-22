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

export type DeployedPowerCreep = PowerCreep & { room: Room }
export const isDeployedPowerCreep = (powerCreep: PowerCreep): powerCreep is DeployedPowerCreep => {
  if (powerCreep.room == null) {
    return false
  }
  return true
}

export type AnyDeployedCreep = Creep | DeployedPowerCreep
