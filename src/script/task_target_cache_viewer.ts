import { TaskTargetTypeId, TaskTargetCache } from "task/object_task_target_cache"

export function showTargetedBy(targetIds: string[]): string {
  return targetIds
    .map(targetId => {
      const taskRunners = TaskTargetCache.targetingTaskRunnerIds(targetId as TaskTargetTypeId)
      return `- ${targetId} (${taskRunners.length}): ${taskRunners}`
    })
    .join("\n")
}
