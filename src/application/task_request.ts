import { CreepTask } from "object_task/creep_task/creep_task"
import { GameConstants } from "utility/constants"
import { bodyCost } from "utility/creep_body"
import { Timestamp } from "shared/utility/timestamp"
import type { TaskIdentifier } from "./task_identifier"

export type TaskRequestCreepTaskType = "normal" | "flee"

export interface CreepTaskAssignTaskRequest {
  taskType: TaskRequestCreepTaskType
  task: CreepTask
}

export type SpawnTaskRequestType = SpawnCreepTaskRequest //| RenewCreepTaskRequest // TODO:
export type TaskRequest = SpawnTaskRequest | TowerActionTaskRequest

type SpawnTaskRequestPriorityUrgent = 0
type SpawnTaskRequestPriorityRightNow = 1
type SpawnTaskRequestPriorityAnyTime = 2
type SpawnTaskRequestPriorityCancellable = 3
const spawnTaskRequestPriorityUrgent: SpawnTaskRequestPriorityUrgent = 0
const spawnTaskRequestPriorityRightNow: SpawnTaskRequestPriorityRightNow = 1
const spawnTaskRequestPriorityAnyTime: SpawnTaskRequestPriorityAnyTime = 2
const spawnTaskRequestPriorityCancellable: SpawnTaskRequestPriorityCancellable = 3

export type SpawnTaskRequestPriority = 0 | 1 | 2 | 3
export const SpawnTaskRequestPriority = {
  Urgent: spawnTaskRequestPriorityUrgent,
  RightNow: spawnTaskRequestPriorityRightNow,
  Anytime: spawnTaskRequestPriorityAnyTime,
  Cancellable: spawnTaskRequestPriorityCancellable,
}

interface SpawnTaskRequest {
  spawnTaskRequestType: "spawn" | "renew"
  priority: SpawnTaskRequestPriority
  energyCost: number
  spawnTimeCost: Timestamp
  neededIn: Timestamp
}

export class SpawnCreepTaskRequest implements SpawnTaskRequest {
  public readonly spawnTaskRequestType = "spawn"
  public readonly energyCost: number
  public readonly spawnTimeCost: Timestamp

  public constructor(
    public readonly priority: SpawnTaskRequestPriority,
    public readonly codename: string,
    public readonly taskIdentifier: TaskIdentifier,
    public readonly creepIdentifier: string | null,
    public readonly body: BodyPartConstant[],
    public readonly initialTask: CreepTask | null,
    public readonly neededIn: Timestamp,
  ) {
    this.energyCost = bodyCost(this.body)
    this.spawnTimeCost = this.body.length * GameConstants.creep.life.spawnTime
  }
}

// export class RenewCreepTaskRequest implements SpawnTaskRequest {
//   public readonly spawnTaskRequestType = "renew"
//   public readonly estimatedTimeToStart: number
//   public readonly estimatedDuration: number

//   public constructor(
//     creep: Creep,
//   ) {
//     this.estimatedTimeToStart = 0 // FixMe:
//     this.estimatedDuration = estimatedRenewDuration(creep.body.length, creep.ticksToLive || 0)
//   }
// }

export interface TowerActionTaskRequest {
}
