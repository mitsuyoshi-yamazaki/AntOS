import { ObjectTask, TaskProgressType } from "object_task/object_task"
import type { CreepTaskState } from "./creep_task_state"

export interface CreepTask extends ObjectTask<Creep> {
  shortDescription?: string

  encode(): CreepTaskState
  run(creep: Creep): TaskProgressType
}
