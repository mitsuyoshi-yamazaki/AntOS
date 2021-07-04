import { DecodeFailureTaskReasonUnknown } from "task/failure_task"
import { TaskInProgress } from "task/task"
import { CreepTargetingTask, CreepTargetingTaskState } from "../creep_targeting_task"
import { CreepTask, CreepTaskState, decodeCreepTaskFromState, CreepDecodeFailureTask, CreepTaskProgressType } from "../creep_task"
import { MoveTask, MoveTaskState } from "../primitive_task/move_task"

export interface MoveToTargetTaskState extends CreepTaskState {
  /** work task state */
  w: CreepTargetingTaskState

  /** move task state */
  m: MoveTaskState
}

export class MoveToTargetTask implements CreepTask<void> {
  public constructor(
    public readonly startTime: number,
    public readonly workTask: CreepTargetingTask,
    public readonly moveTask: MoveTask,
  ) { }

  public encode(): MoveToTargetTaskState {
    return {
      t: "MoveToTargetTask",
      s: this.startTime,
      w: this.workTask.encode(),
      m: this.moveTask.encode(),
    }
  }

  public static decode(state: MoveToTargetTaskState): MoveToTargetTask | CreepDecodeFailureTask {
    const workTask = decodeCreepTaskFromState(state.w)
    if (workTask instanceof CreepDecodeFailureTask) {
      return workTask
    }
    const moveTask = MoveTask.decode(state.m)
    if (!(workTask instanceof CreepTargetingTask)) {
      return new CreepDecodeFailureTask(state.t, state.s, new DecodeFailureTaskReasonUnknown())
    }
    return new MoveToTargetTask(state.s, workTask, moveTask)
  }

  public run(creep: Creep): CreepTaskProgressType<void> {
    const result = this.workTask.run(creep)

    switch (result.taskProgressType) {
    default:
      return new TaskInProgress(undefined)  // TODO:
    }
  }
}
