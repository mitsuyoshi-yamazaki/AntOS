import { TaskProgressType } from "object_task/object_task"
import { CreepName } from "prototype/creep"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface PullTaskState extends CreepTaskState {
  /** target creep name */
  c: CreepName
}

// TODO: Pullしているとすれ違えない
export class PullTask implements CreepTask {
  public readonly shortDescription = "pull"

  private constructor(
    public readonly startTime: number,
  ) {
  }

  public encode(): PullTaskState {
    return {
      s: this.startTime,
      t: "PullTask",
    }
  }

  public static decode(state: PullTaskState): PullTask {
    return new PullTask(state.s)
  }

  public static create(): PullTask {
    return new PullTask(Game.time)
  }

  public run(): TaskProgressType {
    return TaskProgressType.InProgress
  }
}
