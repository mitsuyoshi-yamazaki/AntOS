import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface EndlessTaskState extends CreepTaskState {
}

export class EndlessTask implements CreepTask {
  public readonly shortDescription = "stay"

  private constructor(
  ) {
  }

  public encode(): EndlessTaskState {
    return {
      t: "EndlessTask",
    }
  }

  public static decode(state: EndlessTaskState): EndlessTask {
    return new EndlessTask()
  }

  public static create(): EndlessTask {
    return new EndlessTask()
  }

  public run(): TaskProgressType {
    return TaskProgressType.InProgress
  }
}
