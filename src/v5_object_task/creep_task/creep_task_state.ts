import { ObjectTaskState } from "v5_object_task/object_task"
import type { CreepTaskType } from "./creep_task_decoder"

export interface CreepTaskState extends ObjectTaskState {
  /** type identifier */
  t: CreepTaskType
}
