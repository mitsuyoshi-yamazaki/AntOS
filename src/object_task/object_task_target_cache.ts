import type { RoomPositionId } from "prototype/room_position"
import { ValuedArrayMap } from "utility/valued_map"

export type TaskRunnerType = Creep | StructureSpawn | StructureTower
type IdRepresentableTaskTargetType = AnyCreep | Resource | Tombstone | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>
export type TaskTargetType = IdRepresentableTaskTargetType | RoomPosition

export type TaskRunnerId = Id<TaskRunnerType>
export type TaskTargetTypeId = Id<IdRepresentableTaskTargetType> | RoomPositionId

export type TaskTargetCacheTaskType = "build" | "repair"

export interface ObjectTaskTarget {
  targetId: TaskTargetTypeId
  taskTypes: TaskTargetCacheTaskType[]
}

class TargetingTaskRunnerIds {
  private readonly taskRunnerIds = new ValuedArrayMap<TaskTargetCacheTaskType, TaskRunnerId>()

  public setId(taskRunnerId: TaskRunnerId, taskType: TaskTargetCacheTaskType): void {
    const taskRunnerIds = this.taskRunnerIds.get(taskType)
    if (taskRunnerIds.includes(taskRunnerId) === true) {
      return
    }
    taskRunnerIds.push(taskRunnerId)
  }

  public removeId(taskRunnerId: TaskRunnerId, taskType: TaskTargetCacheTaskType): void {
    const taskRunnerIds = this.taskRunnerIds.get(taskType)
    const index = taskRunnerIds.indexOf(taskRunnerId)
    if (index < 0) {
      return
    }
    taskRunnerIds.splice(index, 1)
  }

  public getIds(taskType?: TaskTargetCacheTaskType): TaskRunnerId[] {
    if (taskType != null) {
      return this.taskRunnerIds.get(taskType) ?? []
    }
    return [...new Set(Array.from(this.taskRunnerIds.values()).flatMap(v => v))]
  }
}

const cache = new Map<TaskTargetTypeId, TargetingTaskRunnerIds>()

export const TaskTargetCache = {
  clearCache(): void {
    cache.clear()
  },

  didAssignTask(taskRunnerId: TaskRunnerId, targets: ObjectTaskTarget[]): void {
    addTaskRunner(taskRunnerId, targets)
  },

  didFinishTask(taskRunnerId: TaskRunnerId, targets: ObjectTaskTarget[]): void {
    removeTaskRunner(taskRunnerId, targets)
  },

  targetingTaskRunnerIds(targetId: TaskTargetTypeId, taskType?: TaskTargetCacheTaskType): TaskRunnerId[] {
    return cache.get(targetId)?.getIds(taskType) ?? []
  },
}

function addTaskRunner(taskRunnerId: TaskRunnerId, targets: ObjectTaskTarget[]): void {
  targets.forEach(target => {
    const taskRunnerIds = ((): TargetingTaskRunnerIds => {
      const stored = cache.get(target.targetId)
      if (stored != null) {
        return stored
      }
      const newValue = new TargetingTaskRunnerIds()
      cache.set(target.targetId, newValue)
      return newValue
    })()

    target.taskTypes.forEach(taskType => {
      taskRunnerIds.setId(taskRunnerId, taskType)
    })
  })
}

function removeTaskRunner(taskRunnerId: TaskRunnerId, targets: ObjectTaskTarget[]): void {
  targets.forEach(target => {
    const taskRunnerIds = cache.get(target.targetId)
    if (taskRunnerIds == null) {
      return
    }
    target.taskTypes.forEach(taskType => {
      taskRunnerIds.removeId(taskRunnerId, taskType)
    })
  })
}
