import { TaskInProgress } from "task/task"
import { CreepTask, CreepTaskProgressType, CreepTaskState } from "../creep_task"

export interface MoveToAdjacentTaskState extends CreepTaskState {
}

export class MoveToAdjacentTask implements CreepTask<void> {  // TODO:
  public constructor(
    public readonly startTime: number,
  ) { }

  public encode(): MoveTaskState {
    return {
      s: this.startTime,
      t: "MoveTask",
    }
  }

  public static decode(state: MoveTaskState): MoveToAdjacentTask {
    return new MoveTask(state.s)
  }

  public run(creep: Creep): CreepTaskProgressType<void> {
    return new TaskInProgress(undefined)  // TODO:
  }
}
