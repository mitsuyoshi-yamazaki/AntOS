import { TargetType, TaskRunnerType } from "./game_object_task"

type TaskRunnerId = Id<TaskRunnerType>
type TargetTypeId = Id<TargetType>

const cache = new Map<TargetTypeId, TaskRunnerId[]>()

// TODO: Process適合にする
export const TaskTargetCache = {
  clearCache: (): void => {
    cache.clear()

    for (const creep_name in Game.creeps) {
      const creep = Game.creeps[creep_name]
      if (creep.task == null || creep.task.targetId == null) {
        continue
      }
      addTaskRunner(creep.id, creep.task.targetId)
    }

    // TODO: Spawn
    // TODO: Tower
  },
  didAssignTask(taskRunnerId: TaskRunnerId, targetId: TargetTypeId): void {
    addTaskRunner(taskRunnerId, targetId)
  },
  didFinishTask(taskRunnerId: TaskRunnerId, targetId: TargetTypeId): void {
    removeTaskRunner(taskRunnerId, targetId)
  },
  targetingTaskRunnerIds(targetId: TargetTypeId): TaskRunnerId[] {
    return cache.get(targetId) ?? []
  }
}

function addTaskRunner(taskRunnerId: TaskRunnerId, targetId: TargetTypeId): void {
  const taskRunnerIds = cache.get(targetId) ?? []
  if (taskRunnerIds.includes(taskRunnerId) === true) {
    return
  }
  taskRunnerIds.push(taskRunnerId)
  cache.set(targetId, taskRunnerIds)
}

function removeTaskRunner(taskRunnerId: TaskRunnerId, targetId: TargetTypeId): void {
  const taskRunnerIds = cache.get(targetId)
  if (taskRunnerIds == null) {
    return
  }
  const index = taskRunnerIds.indexOf(taskRunnerId)
  if (index < 0) {
    return
  }
  taskRunnerIds.splice(index, 1)
}
