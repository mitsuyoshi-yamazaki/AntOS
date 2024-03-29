import type { RoomPositionId } from "prototype/room_position"

export type TaskRunnerType = Creep | StructureSpawn | StructureTower
type IdRepresentableTaskTargetType = AnyCreep | Resource | Tombstone | AnyStructure | Source | ConstructionSite<BuildableStructureConstant> | Ruin
export type TaskTargetType = IdRepresentableTaskTargetType | RoomPosition

export type TaskRunnerId = Id<TaskRunnerType>
export type TaskTargetTypeId = Id<IdRepresentableTaskTargetType> | RoomPositionId
type TaskTargetCacheKey = TaskTargetTypeId

const cache = new Map<TaskTargetCacheKey, TaskRunnerId[]>()

// TODO: Process適合にする
/** @deprecated */
export const TaskTargetCache = {
  clearCache(): void {
    cache.clear()
  },

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
