import { Timestamp } from "shared/utility/timestamp"
import { TaskProgressType } from "v5_object_task/object_task"
import { TaskTargetTypeId } from "v5_object_task/object_task_target_cache"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface Run1TickTaskState extends CreepTaskState {
  readonly childTaskState: CreepTaskState
  readonly until: Timestamp
}

export class Run1TickTask implements CreepTask {
  public readonly shortDescription: string | undefined

  public get targetId(): TaskTargetTypeId | undefined {
    return this.childTask.targetId
  }

  private constructor(
    public readonly startTime: number,
    private readonly childTask: CreepTask,
    private readonly until: Timestamp,
  ) {
    this.shortDescription = this.childTask.shortDescription
  }

  public encode(): Run1TickTaskState {
    return {
      s: this.startTime,
      t: "Run1TickTask",
      childTaskState: this.childTask.encode(),
      until: this.until,
    }
  }

  public static decode(state: Run1TickTaskState, childTask: CreepTask): Run1TickTask {
    return new Run1TickTask(state.s, childTask, state.until ?? (Game.time + 1))
  }

  public static create(childTask: CreepTask, options?: { duration?: number }): Run1TickTask {
    const until = Game.time + (options?.duration ?? 1)
    return new Run1TickTask(Game.time, childTask, until)
  }

  public run(creep: Creep): TaskProgressType {
    const result = this.childTask.run(creep)

    switch (result) {
    case TaskProgressType.Finished:
    case TaskProgressType.FinishedAndRan:
      return result
    case TaskProgressType.InProgress:
      if (Game.time >= this.until) {
        return TaskProgressType.FinishedAndRan
      }
      return TaskProgressType.InProgress
    }
  }
}
