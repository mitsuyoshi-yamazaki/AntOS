import { ObjectTask } from "object_task/object_task"
import { TaskProgress } from "object_task/object_task"
import type { CreepTaskState } from "./creep_task_state"
import type { CreepApi } from "./creep_api"
import type { CreepName } from "prototype/creep"

export type CreepTaskProgress = TaskProgress<CreepApi, CreepName>
export const CreepTaskProgress = TaskProgress

export interface CreepTask extends ObjectTask<Creep, CreepApi, CreepName> {
  shortDescription: string

  encode(): CreepTaskState
  run(creep: Creep): CreepTaskProgress
}
