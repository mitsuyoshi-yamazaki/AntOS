import { TaskProgressType } from "object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface EndlessTaskState extends CreepTaskState {
}

export class EndlessTask implements CreepTask {
  public readonly shortDescription = "stay"

  private constructor(
    public readonly startTime: number,
  ) {
  }

  public encode(): EndlessTaskState {
    return {
      s: this.startTime,
      t: "EndlessTask",
    }
  }

  public static decode(state: EndlessTaskState): EndlessTask {
    return new EndlessTask(state.s)
  }

  public static create(): EndlessTask {
    return new EndlessTask(Game.time)
  }

  public run(): TaskProgressType {
    return TaskProgressType.InProgress
  }
}
