import { CreepTask } from "object_task/creep_task/creep_task"
import type { CreepRole } from "prototype/creep_role"
import { estimatedRenewDuration } from "utility/constants"
import type { TaskIdentifier } from "./task_identifier"

export type TaskRequestCreepTaskType = "normal" | "flee"

export interface CreepTaskAssignTaskRequest {
  taskType: TaskRequestCreepTaskType
  task: CreepTask
}

export type SpawnTaskRequestType = SpawnCreepTaskRequest //| RenewCreepTaskRequest // TODO:
export type TaskRequest = SpawnTaskRequest | TowerActionTaskRequest

type SpawnTaskRequestPriorityUrgent = 0
type SpawnTaskRequestPriorityHigh = 1
type SpawnTaskRequestPriorityMedium = 2
type SpawnTaskRequestPriorityLow = 3

const spawnTaskRequestPriorityUrgent: SpawnTaskRequestPriorityUrgent = 0
const spawnTaskRequestPriorityHigh: SpawnTaskRequestPriorityHigh = 1
const spawnTaskRequestPriorityMedium: SpawnTaskRequestPriorityMedium = 2
const spawnTaskRequestPriorityLow: SpawnTaskRequestPriorityLow = 3

export type SpawnTaskRequestPriority = SpawnTaskRequestPriorityUrgent | SpawnTaskRequestPriorityHigh | SpawnTaskRequestPriorityMedium | SpawnTaskRequestPriorityLow
export const SpawnTaskRequestPriority = {
  Urgent: spawnTaskRequestPriorityUrgent,
  High: spawnTaskRequestPriorityHigh,
  Medium: spawnTaskRequestPriorityMedium,
  Low: spawnTaskRequestPriorityLow,
}

interface SpawnTaskRequest {
  spawnTaskRequestType: "spawn" | "renew"
  estimatedDuration: number
  estimatedTimeToStart: number
}

export class SpawnCreepTaskRequest implements SpawnTaskRequest {
  public readonly spawnTaskRequestType = "spawn"
  public readonly estimatedTimeToStart = 0
  public readonly estimatedDuration: number

  public constructor(
    public readonly taskIdentifier: TaskIdentifier,
    public readonly priority: SpawnTaskRequestPriority,
    public readonly body: BodyPartConstant[],
    public readonly roles: CreepRole[],
    public readonly codename: string,
  ) {
    this.estimatedDuration = this.body.length * CREEP_SPAWN_TIME
  }
}

export class RenewCreepTaskRequest implements SpawnTaskRequest {
  public readonly spawnTaskRequestType = "renew"
  public readonly estimatedTimeToStart: number
  public readonly estimatedDuration: number

  public constructor(
    creep: Creep,
  ) {
    this.estimatedTimeToStart = 0 // FixMe:
    this.estimatedDuration = estimatedRenewDuration(creep.body.length, creep.ticksToLive || 0)
  }
}

export interface TowerActionTaskRequest {
}
