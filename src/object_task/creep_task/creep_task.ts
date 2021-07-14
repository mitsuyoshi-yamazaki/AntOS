import { ObjectTask } from "object_task/object_task"
import { TaskProgress } from "object_task/object_task"
import type { CreepTaskState } from "./creep_task_state"
import type { CreepName } from "prototype/creep"
import type { CreepApiWrapperType } from "./creep_api_wrapper"

export type CreepTaskProgress = TaskProgress<CreepApiWrapperType, CreepName>
export const CreepTaskProgress = TaskProgress

export interface CreepTask extends ObjectTask<Creep, CreepApiWrapperType, CreepName> {
  shortDescription: string

  encode(): CreepTaskState
  run(creep: Creep): CreepTaskProgress
}
