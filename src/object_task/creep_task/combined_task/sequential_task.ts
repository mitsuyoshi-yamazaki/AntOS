import { TaskProgressType } from "object_task/object_task"
import { CreepTask, CreepTaskState, decodeCreepTaskFromState } from "../creep_task"

export interface SequentialTaskOptions {
  /**
   * - falseの場合、子タスクの失敗でequentialTask自体を終了する
   * - ※ 現状ではデコードの失敗のみにしか対応していない
  */
  ignoreFailure: boolean

  /** 子タスクが成功した場合、SequentialTask自体を終了する */
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
  private constructor(
    public readonly startTime: number,
    private readonly childTasks: CreepTask[],
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

  public static decode(state: SequentialTaskState): SequentialTask | null {
    const ignoreFailure = state.o.i
    const children: CreepTask[] = []
    for (const childState of state.c) {
      const child = decodeCreepTaskFromState(childState)
      if (child != null) {
        children.push(child)
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
    return new SequentialTask(state.s, children, options)
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
      return TaskProgressType.FinishedAndRan

    case TaskProgressType.InProgress:
      return TaskProgressType.InProgress
    }
  }
}
