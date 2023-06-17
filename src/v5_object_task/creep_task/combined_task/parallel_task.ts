import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface ParallelTaskState extends CreepTaskState {
  /** child task states */
  c: CreepTaskState[]

}

/**
 * - 毎tick終了する
 */
export class ParallelTask implements CreepTask {
  private constructor(
    public readonly childTasks: CreepTask[],
  ) {
  }

  public encode(): ParallelTaskState {
    return {
      t: "ParallelTask",
      c: this.childTasks.map(task => task.encode()),
    }
  }

  public static decode(state: ParallelTaskState, children: CreepTask[]): ParallelTask {
    return new ParallelTask(children)
  }

  public static create(childTasks: CreepTask[]): ParallelTask {
    return new ParallelTask(childTasks)
  }

  public run(creep: Creep): TaskProgressType {
    this.childTasks.forEach(task => {
      task.run(creep)
    })
    return TaskProgressType.FinishedAndRan
  }
}
