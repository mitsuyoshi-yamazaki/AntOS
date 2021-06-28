import { TargetTypeId, TaskTargetCache } from "game_object_task/task_target_cache"

export function showTargetedBy(targetIds: string[]): string {
  return targetIds
    .map(targetId => {
      const taskRunners = TaskTargetCache.targetingTaskRunnerIds(targetId as TargetTypeId)
      return `- ${targetId} (${taskRunners.length}): ${taskRunners}`
    })
    .join("\n")
}
