import { TaskProgressType } from "v5_object_task/object_task"
import { CreepName } from "prototype/creep"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface PullFollowerTaskState extends CreepTaskState {
  /** target creep name */
  c: CreepName
}

export class PullFollowerTask implements CreepTask {
  public readonly shortDescription = "pull"

  private constructor(
    public readonly startTime: number,
  ) {
  }

  public encode(): PullFollowerTaskState {
    return {
      s: this.startTime,
      t: "PullFollowerTask",
    }
  }

  public static decode(state: PullFollowerTaskState): PullFollowerTask {
    return new PullFollowerTask(state.s)
  }

  public static create(): PullFollowerTask {
    return new PullFollowerTask(Game.time)
  }

  public run(): TaskProgressType {
    return TaskProgressType.InProgress
  }
}
