import { TaskRunnerInfo, TaskTargetCache, TaskTargetCacheTaskType } from "object_task/object_task_target_cache"

export type PowerCreepName = string

declare global {
  interface PowerCreep {
    targetedBy(taskType: TaskTargetCacheTaskType): TaskRunnerInfo[]
  }
}

// サーバーリセット時のみ呼び出し
export function init(): void {
  PowerCreep.prototype.targetedBy = function (taskType: TaskTargetCacheTaskType): TaskRunnerInfo[] {
    return TaskTargetCache.creepTargetingTaskRunnerInfo(this.id, taskType)
  }
}

export type DeployedPowerCreep = PowerCreep & Readonly<{ room: Room, ticksToLive: number }>
export const isDeployedPowerCreep = (powerCreep: PowerCreep): powerCreep is DeployedPowerCreep => {
  if (powerCreep.room == null) {
    return false
  }
  return true
}

export type AnyDeployedCreep = Creep | DeployedPowerCreep
