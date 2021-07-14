import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface SquadFollowerTaskState extends CreepTaskState {
}

export class SquadFollowerTask implements CreepTask {
  public readonly shortDescription = "follow"

  private constructor(
    public readonly startTime: number,
  ) {
  }

  public encode(): SquadFollowerTaskState {
    return {
      s: this.startTime,
      t: "SquadFollowerTask",
    }
  }

  public static decode(state: SquadFollowerTaskState): SquadFollowerTask {
    return new SquadFollowerTask(state.s)
  }

  public static create(): SquadFollowerTask {
    return new SquadFollowerTask(Game.time)
  }

  public run(): TaskProgressType {
    return TaskProgressType.InProgress
  }
}
