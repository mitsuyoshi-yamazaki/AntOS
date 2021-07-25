import type { RoomPositionId } from "prototype/room_position"
import { CreepBodyActionType } from "utility/creep_body"
import { ValuedArrayMap, ValuedMapArrayMap } from "utility/valued_collection"

export type TaskRunnerType = Creep | StructureSpawn | StructureTower
export type TaskRunnerId = Id<TaskRunnerType>
type TaskTargetPositionConcreteType = AnyCreep | Resource | Tombstone | AnyStructure | Source | Mineral | ConstructionSite<BuildableStructureConstant>

export type TaskTargetType = AnyCreep | TaskTargetPositionConcreteType | RoomPosition
// type TaskTargetTypeId = RoomPositionId | Id<AnyCreep>
export type TaskTargetCacheTaskType = CreepBodyActionType | "move" | "transfer" | "withdraw"

export interface TaskTargetCreep {
  taskTargetType: "creep"
  targetCreep: AnyCreep
  taskType: TaskTargetCacheTaskType
  amount: number
}

export interface TaskTargetPosition {
  taskTargetType: "position"
  position: RoomPosition
  concreteTarget: TaskTargetPositionConcreteType | null
  taskType: TaskTargetCacheTaskType
  amount: number
}

export type TaskTarget = TaskTargetCreep | TaskTargetPosition

export interface TaskRunnerInfo {
  readonly taskRunnerId: TaskRunnerId
  readonly amount: number
}

interface TaskTargetPositionInfo {
  readonly concreteObjects: TaskTargetPositionConcreteType[]
  readonly taskRunnerInfo: ValuedArrayMap<TaskTargetCacheTaskType, TaskRunnerInfo>
}

export interface PositionTaskRunnerInfo {
  taskRunnerInfo: TaskRunnerInfo[]
  concreteTargets: TaskTargetPositionConcreteType[]
}

// Map<Id<AnyCreep>, Map<TaskTargetCacheTaskType, TaskRunnerInfo[]>>
const targetCreepCache = new ValuedMapArrayMap<Id<AnyCreep>, TaskTargetCacheTaskType, TaskRunnerInfo>()
const targetPositionCache = new Map<RoomPositionId, TaskTargetPositionInfo>()

export const TaskTargetCache = {
  // TODO: harvester creepをpositionのconcrete targetとして登録する必要がある
  // 墓石が重なっていることもある

  clearCache(): void {
    targetCreepCache.clear()
    targetPositionCache.clear()
  },

  didAssignTask(taskRunnerId: TaskRunnerId, targets: TaskTarget[]): void {
    targets.forEach(target => {
      switch (target.taskTargetType) {
      case "creep": {
        const taskList = targetCreepCache.getValueFor(target.targetCreep.id).getValueFor(target.taskType)
        taskList.push({
          taskRunnerId: taskRunnerId,
          amount: target.amount,
        })
        break
      }
      case "position": {
        const positionInfo = ((): TaskTargetPositionInfo => {
          const stored = targetPositionCache.get(target.position.id)
          if (stored != null) {
            return stored
          }
          const newInfo: TaskTargetPositionInfo = {
            concreteObjects: [],
            taskRunnerInfo: new ValuedArrayMap<TaskTargetCacheTaskType, TaskRunnerInfo>(),
          }
          targetPositionCache.set(target.position.id, newInfo)
          return newInfo
        })()
        if (target.concreteTarget != null) {
          positionInfo.concreteObjects.push(target.concreteTarget)
        }
        positionInfo.taskRunnerInfo.getValueFor(target.taskType).push({
          taskRunnerId: taskRunnerId,
          amount: target.amount,
        })
        break
      }
      }
    })
  },

  registerPositionTarget(target: TaskTargetPositionConcreteType): void {  // TODO: 呼び出す
    const targetId = target.pos.id
    const targetPositionInfo = ((): TaskTargetPositionInfo => {
      const stored = targetPositionCache.get(targetId)
      if (stored != null) {
        return stored
      }
      const newInfo: TaskTargetPositionInfo = {
        concreteObjects: [],
        taskRunnerInfo: new ValuedArrayMap<TaskTargetCacheTaskType, TaskRunnerInfo>(),
      }
      targetPositionCache.set(targetId, newInfo)
      return newInfo
    })()

    targetPositionInfo.concreteObjects.push(target)
  },

  // didFinishTask(taskRunnerId: TaskRunnerId, targets: TaskTarget[]): void { // tickごとに更新されるので不要
  // },

  creepTargetingTaskRunnerInfo(targetId: Id<AnyCreep>, taskType: TaskTargetCacheTaskType): TaskRunnerInfo[] {
    const targetInfo = targetCreepCache.get(targetId)
    if (targetInfo == null) {
      return []
    }
    // if (taskType == null) {  // 必要があれば
    //   return Array.from(targetInfo.values()).flatMap(v => v)
    // }
    return targetInfo.get(taskType) ?? []
  },

  positionTargetingTaskRunnerInfo(targetId: RoomPositionId, taskType: TaskTargetCacheTaskType): PositionTaskRunnerInfo {
    const targetInfo = targetPositionCache.get(targetId)
    if (targetInfo == null) {
      return {
        taskRunnerInfo: [],
        concreteTargets: [],
      }
    }
    // if (taskType == null) {  // 必要があれば
    //   return Array.from(targetInfo.taskRunnerInfo.values()).flatMap(v => v)
    // }
    const taskRunners = targetInfo.taskRunnerInfo.get(taskType)
    if (taskRunners == null) {
      return {
        taskRunnerInfo: [],
        concreteTargets: targetInfo.concreteObjects
      }
    }
    return {
      taskRunnerInfo: taskRunners,
      concreteTargets: targetInfo.concreteObjects
    }
  },
}


// //
// export type TaskTargetType = TaskTargetPositionConcreteType | RoomPosition



// class TaskTargetContainer {
//   private readonly targets: TaskTargetType[] = []


// }

// class TargetingTaskRunnerIds {
//   private readonly taskRunnerIds = new ValuedArrayMap<TaskTargetCacheTaskType, TaskRunnerId>()

//   public setId(taskRunnerId: TaskRunnerId, taskType: TaskTargetCacheTaskType): void {
//     const taskRunnerIds = this.taskRunnerIds.get(taskType)
//     if (taskRunnerIds.includes(taskRunnerId) === true) {
//       return
//     }
//     taskRunnerIds.push(taskRunnerId)
//   }

//   public removeId(taskRunnerId: TaskRunnerId, taskType: TaskTargetCacheTaskType): void {
//     const taskRunnerIds = this.taskRunnerIds.get(taskType)
//     const index = taskRunnerIds.indexOf(taskRunnerId)
//     if (index < 0) {
//       return
//     }
//     taskRunnerIds.splice(index, 1)
//   }

//   public getIds(taskType?: TaskTargetCacheTaskType): TaskRunnerId[] {
//     if (taskType != null) {
//       return this.taskRunnerIds.get(taskType) ?? []
//     }
//     return [...new Set(Array.from(this.taskRunnerIds.values()).flatMap(v => v))]
//   }
// }

// const cache = new Map<TaskTargetTypeId, TargetingTaskRunnerIds>()

// // RoomはnullableなのでTargetCacheの仕組みに入れるとしても別で行う
// export const TaskTargetCache = {
//   clearCache(): void {
//     cache.clear()
//   },

//   didAssignTask(taskRunnerId: TaskRunnerId, targets: ObjectTaskTarget[]): void {
//     addTaskRunner(taskRunnerId, targets)
//   },

//   didFinishTask(taskRunnerId: TaskRunnerId, targets: ObjectTaskTarget[]): void {
//     removeTaskRunner(taskRunnerId, targets)
//   },

//   targetingTaskRunnerIds(targetId: TaskTargetTypeId, taskType?: TaskTargetCacheTaskType): TaskRunnerId[] {
//     return cache.get(targetId)?.getIds(taskType) ?? []
//   },
// }

// function addTaskRunner(taskRunnerId: TaskRunnerId, targets: ObjectTaskTarget[]): void {
//   targets.forEach(target => {
//     const taskRunnerIds = ((): TargetingTaskRunnerIds => {
//       const stored = cache.get(target.targetId)
//       if (stored != null) {
//         return stored
//       }
//       const newValue = new TargetingTaskRunnerIds()
//       cache.set(target.targetId, newValue)
//       return newValue
//     })()

//     target.taskTypes.forEach(taskType => {
//       taskRunnerIds.setId(taskRunnerId, taskType)
//     })
//   })
// }

// function removeTaskRunner(taskRunnerId: TaskRunnerId, targets: ObjectTaskTarget[]): void {
//   targets.forEach(target => {
//     const taskRunnerIds = cache.get(target.targetId)
//     if (taskRunnerIds == null) {
//       return
//     }
//     target.taskTypes.forEach(taskType => {
//       taskRunnerIds.removeId(taskRunnerId, taskType)
//     })
//   })
// }
