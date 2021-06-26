import { TaskRunnerType } from "game_object_task/game_object_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"

declare global {
  interface RoomObject {
    targetedBy: Id<TaskRunnerType>[]
  }
}

export function init(): void {
  Object.defineProperty(RoomObject.prototype, "targetedBy", {
    get(): Id<TaskRunnerType>[] {
      return TaskTargetCache.targetingTaskRunnerIds(this.id)
    },
  })
}
