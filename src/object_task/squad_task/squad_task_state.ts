import { ObjectTaskState } from "object_task/object_task"
import type { SquadTaskType } from "./squad_task_decoder"

export interface SquadTaskState extends ObjectTaskState {
  /** type identifier */
  t: SquadTaskType
}
