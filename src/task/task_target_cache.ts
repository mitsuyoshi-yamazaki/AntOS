export type TaskRunnerType = Creep | StructureSpawn | StructureTower
export type TaskTargetType = Creep | PowerCreep | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>

export type TaskRunnerId = Id<TaskRunnerType>
export type TaskTargetTypeId = Id<TaskTargetType>
type TaskTargetCacheKey = TaskTargetTypeId

const cache = new Map<TaskTargetCacheKey, TaskRunnerId[]>()

// TODO: Process適合にする
export const TaskTargetCache = {
  didAssignTask(taskRunnerId: TaskRunnerId, targetId: TaskTargetCacheKey): void {
    addTaskRunner(taskRunnerId, targetId)
  },
  didFinishTask(taskRunnerId: TaskRunnerId, targetId: TaskTargetCacheKey): void {
    removeTaskRunner(taskRunnerId, targetId)
  },
  targetingTaskRunnerIds(targetId: TaskTargetCacheKey): TaskRunnerId[] {
    return cache.get(targetId) ?? []
  },
}

function addTaskRunner(taskRunnerId: TaskRunnerId, key: TaskTargetCacheKey): void {
  const taskRunnerIds = cache.get(key) ?? []
  if (taskRunnerIds.includes(taskRunnerId) === true) {
    return
  }
  taskRunnerIds.push(taskRunnerId)
  cache.set(key, taskRunnerIds)
}

function removeTaskRunner(taskRunnerId: TaskRunnerId, key: TaskTargetCacheKey): void {
  const taskRunnerIds = cache.get(key)
  if (taskRunnerIds == null) {
    return
  }
  const index = taskRunnerIds.indexOf(taskRunnerId)
  if (index < 0) {
    return
  }
  taskRunnerIds.splice(index, 1)
}
