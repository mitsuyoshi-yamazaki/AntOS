import { TaskProgressType } from "v5_object_task/object_task"
import { TaskTargetTypeId } from "v5_object_task/object_task_target_cache"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface SequentialTaskOptions {
  /**
   * - falseの場合、子タスクの失敗でequentialTask自体を終了する
   * - ※ 現状ではデコードの失敗のみにしか対応していない
  */
  ignoreFailure: boolean

  /** 子タスクがひとつでも成功した場合、SequentialTask自体を終了する */
  finishWhenSucceed: boolean
}

export interface SequentialTaskState extends CreepTaskState {
  /** child task states */
  c: CreepTaskState[]

  /** options */
  o: {
    /** ignoreFailure */
    i: boolean

    /** finishWhenSucceed */
    f: boolean
  }
}

export class SequentialTask implements CreepTask {
  public get targetId(): TaskTargetTypeId | undefined {
    const currentTask = this.childTasks[0]
    return currentTask?.targetId
  }

  private constructor(
    public readonly startTime: number,
    public readonly childTasks: CreepTask[],
    public readonly options: SequentialTaskOptions,
  ) {
  }

  public encode(): SequentialTaskState {
    return {
      s: this.startTime,
      t: "SequentialTask",
      c: this.childTasks.map(task => task.encode()),
      o: {
        i: this.options.ignoreFailure,
        f: this.options.finishWhenSucceed,
      },
    }
  }

  public static decode(state: SequentialTaskState, children: (CreepTask | null)[]): SequentialTask | null {
    const ignoreFailure = state.o.i
    const filteredChildren: CreepTask[] = []
    for (const child of children) {
      if (child != null) {
        filteredChildren.push(child)
        continue
      }
      if (ignoreFailure === true) {
        continue
      }
      return null
    }
    const options: SequentialTaskOptions = {
      ignoreFailure: state.o.i,
      finishWhenSucceed: state.o.f,
    }
    return new SequentialTask(state.s, filteredChildren, options)
  }

  public static create(childTasks: CreepTask[], options: SequentialTaskOptions): SequentialTask {
    return new SequentialTask(Game.time, childTasks, options)
  }

  public run(creep: Creep): TaskProgressType {
    const currentTask = this.childTasks[0]
    const result = this.runUntilExecution(creep)
    const updatedTask = this.childTasks[0]
    if (currentTask !== updatedTask && updatedTask != null && updatedTask.shortDescription != null) {
      creep.say(updatedTask.shortDescription)
    }
    return result
  }

  private runUntilExecution(creep: Creep): TaskProgressType {
    if (this.childTasks[0] == null) {
      return TaskProgressType.Finished
    }

    const task = this.childTasks[0]
    const result = task.run(creep)

    switch (result) {
    case TaskProgressType.Finished:
      if (this.options.finishWhenSucceed === true) {
        return TaskProgressType.Finished
      }
      this.childTasks.shift()
      return this.runUntilExecution(creep)

    case TaskProgressType.FinishedAndRan:
      if (this.options.finishWhenSucceed === true) {
        return TaskProgressType.FinishedAndRan
      }
      this.childTasks.shift()
      return TaskProgressType.InProgress

    case TaskProgressType.InProgress:
      return TaskProgressType.InProgress
    }
  }
}
