import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomName } from "prototype/room"
import { CreepTask } from "task/creep_task/creep_task"
import { TaskProgressType } from "task/task"
import { ResourcePoolType } from "./resource_pool"
// Worldをimportしない

/** 別タスクの実行中であっても上書きする: 未実装 */
type CreepPoolAssignPriorityUrgent = 0

/** タスク実行中でない場合にアサインする */
type CreepPoolAssignPriorityLow = 1

export const creepPoolAssignPriorityUrgent: CreepPoolAssignPriorityUrgent = 0
export const creepPoolAssignPriorityLow: CreepPoolAssignPriorityLow = 1

export type CreepPoolAssignPriority = CreepPoolAssignPriorityUrgent | CreepPoolAssignPriorityLow
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

  public checkCreeps(filter: CreepPoolFilter): number {
    return this.creeps.filter(filter).length
  }

  /**
   *
   * @param priority
   * @param taskBuilder 必要なだけ新しいCreepTaskを返す
   * @param filter
   */
  public assignTasks(priority: CreepPoolAssignPriority, taskBuilder: CreepPoolTaskBuilder, filter: CreepPoolFilter): void {
    const creeps = ((): Creep[] => {
      switch (priority) {
      case creepPoolAssignPriorityLow:
        return this.creeps.filter(creep => creep.task == null).filter(filter)
      case creepPoolAssignPriorityUrgent:
        PrimitiveLogger.fatal("creepPoolAssignPriorityUrgent not implemented yet")
        return this.creeps.filter(creep => creep.task == null).filter(filter)
      }
    })()

    for (const creep of creeps) {
      const newTask = taskBuilder(creep)
      if (newTask == null) {
        return
      }
      creep.task = newTask
    }
  }

  public executeTask(): void {
    this.creeps.forEach(creep => {
      if (creep.task != null) {
        if (creep.task.run(creep) !== TaskProgressType.InProgress) {
          creep.task = null
        }
      }
    })
  }
}
