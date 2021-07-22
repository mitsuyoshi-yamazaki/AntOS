import { ObjectTask } from "object_task/object_task"
import { TaskProgress } from "object_task/object_task"
import type { V6Creep } from "prototype/creep"
import type { CreepTaskState } from "./creep_task_state"

export type CreepTaskProgress = TaskProgress
export const CreepTaskProgress = TaskProgress

export interface CreepTask extends ObjectTask<V6Creep> {
  shortDescription: string

  encode(): CreepTaskState
  run(creep: V6Creep): CreepTaskProgress
}
