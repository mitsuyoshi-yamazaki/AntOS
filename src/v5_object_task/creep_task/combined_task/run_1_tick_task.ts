import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface Run1TickTaskState extends CreepTaskState {
  childTaskState: CreepTaskState
}

export class Run1TickTask implements CreepTask {
  public readonly shortDescription: string | undefined

  private constructor(
    public readonly startTime: number,
    private readonly childTask: CreepTask,
  ) {
    this.shortDescription = this.childTask.shortDescription
  }

  public encode(): Run1TickTaskState {
    return {
      s: this.startTime,
      t: "Run1TickTask",
      childTaskState: this.childTask.encode(),
    }
  }

  public static decode(state: Run1TickTaskState, childTask: CreepTask): Run1TickTask {
    return new Run1TickTask(state.s, childTask)
  }

  public static create(childTask: CreepTask): Run1TickTask {
    return new Run1TickTask(Game.time, childTask)
  }

  public run(creep: Creep): TaskProgressType {
    const result = this.childTask.run(creep)

    switch (result) {
    case TaskProgressType.Finished:
    case TaskProgressType.FinishedAndRan:
      return result
    case TaskProgressType.InProgress:
      return TaskProgressType.FinishedAndRan
    }
  }
}
