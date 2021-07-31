import { ObjectTask } from "object_task/object_task"
import { TaskProgress } from "object_task/object_task"
import type { TaskTarget } from "object_task/object_task_target_cache"
import type { SquadTaskState } from "./squad_task_state"

export type SquadTaskProgress = TaskProgress
export const SquadTaskProgress = TaskProgress

export abstract class SquadTask implements ObjectTask<void> {
  protected constructor(
    public readonly startTime: number
  ) {
  }

  abstract encode(): SquadTaskState
  abstract taskTargets(): TaskTarget[]
  abstract run(): SquadTaskProgress
}
