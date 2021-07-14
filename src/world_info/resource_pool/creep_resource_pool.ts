import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { isV5CreepMemory } from "prototype/creep"
import { RoomName } from "utility/room_name"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { TaskProgressType } from "v5_object_task/object_task"
import { ResourcePoolType } from "./resource_pool"
import { TaskIdentifier } from "v5_task/task"
// Worldをimportしない

/** 別タスクの実行中であっても上書きする: 未実装 */
type CreepPoolAssignPriorityUrgent = 0

/** タスク実行中でない場合にアサインする */
type CreepPoolAssignPriorityLow = 1

const creepPoolAssignPriorityUrgent: CreepPoolAssignPriorityUrgent = 0
const creepPoolAssignPriorityLow: CreepPoolAssignPriorityLow = 1

export type CreepPoolAssignPriority = CreepPoolAssignPriorityUrgent | CreepPoolAssignPriorityLow
export const CreepPoolAssignPriority = {
  Urgent: creepPoolAssignPriorityUrgent,
  Low: creepPoolAssignPriorityLow,
}

export type CreepPoolFilter = (creep: Creep) => boolean
export type CreepPoolTaskBuilder = (creep: Creep) => CreepTask | null

export class CreepPool implements ResourcePoolType<Creep> {
  private readonly creeps: Creep[] = []

  public constructor(
    public readonly parentRoomName: RoomName,
  ) { }

  public addResource(creep: Creep): void {
    this.creeps.push(creep)
  }

  public countAllCreeps(filter: CreepPoolFilter): number {
    return this.creeps
      .filter(filter)
      .length
  }

  public countCreeps(taskIdentifier: TaskIdentifier | null, filter: CreepPoolFilter): number {
    return this.creeps
      .filter(creep => {
        if (!isV5CreepMemory(creep.memory)) {
          return false
        }
        // eslint-disable-next-line eqeqeq
        if (creep.memory.i != taskIdentifier) {
          return false
        }
        return true
      })
      .filter(filter)
      .length
  }

  /**
   *
   * @param priority
   * @param taskBuilder 必要なだけ新しいCreepTaskを返す
   * @param filter
   */
  public assignTasks(taskIdentifier: TaskIdentifier | null, priority: CreepPoolAssignPriority, taskBuilder: CreepPoolTaskBuilder, filter: CreepPoolFilter): void {
    const creeps = this.creeps
      .filter(creep => {
        if (!isV5CreepMemory(creep.memory)) {
          return false
        }
        // eslint-disable-next-line eqeqeq
        if (creep.memory.i != taskIdentifier) {
          return false
        }
        return true
      })
      .filter(filter)

    const filteredCreeps = ((): Creep[] => {
      switch (priority) {
      case creepPoolAssignPriorityLow:
        return creeps.filter(creep => creep.v5task == null)
      case creepPoolAssignPriorityUrgent:
        PrimitiveLogger.fatal("creepPoolAssignPriorityUrgent not implemented yet")
        return creeps.filter(creep => creep.v5task == null)
      }
    })()

    for (const creep of filteredCreeps) {
      const newTask = taskBuilder(creep)
      if (newTask == null) {
        return
      }
      creep.v5task = newTask
    }
  }

  public takeOverCreeps(taskIdentifier: TaskIdentifier, newIdentifier: TaskIdentifier | null, newParentRoomName: RoomName): void {
    this.creeps.forEach(creep => {
      if (!isV5CreepMemory(creep.memory)) {
        return
      }
      if (creep.memory.i !== taskIdentifier) {
        return
      }
      creep.memory.i = newIdentifier
      creep.memory.p = newParentRoomName
    })
  }

  public executeTask(): void {
    this.creeps.forEach(creep => {
      if (creep.v5task != null) {
        if (creep.v5task.run(creep) !== TaskProgressType.InProgress) {
          creep.v5task = null
        }
      }
    })
  }
}
