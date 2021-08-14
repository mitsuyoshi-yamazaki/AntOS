import { ObjectTask, TaskProgressType } from "v5_object_task/object_task"
import type { CreepTaskState } from "./creep_task_state"

export interface CreepTask extends ObjectTask<Creep> {
  shortDescription?: string

  encode(): CreepTaskState
  run(creep: Creep): TaskProgressType

  pause?(paused: boolean): void // 一時Process等で停止するときのため
}
