import { ObjectTaskTarget } from "object_task/object_task_target_cache"
import { V6Creep } from "prototype/creep"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface SequentialTaskOptions {
}

export interface SequentialTaskState extends CreepTaskState {
  /** type identifier */
  t: "SequentialTask"

  childTaskStates: CreepTaskState[]
}

export class SequentialTask implements CreepTask {
  public readonly shortDescription: string
  public readonly targets: ObjectTaskTarget[]

  private constructor(
    public readonly startTime: number,
    public readonly childTasks: CreepTask[],
  ) {
    this.shortDescription = this.childTasks[0]?.shortDescription ?? ""
    this.targets = this.childTasks.flatMap(task => task.targets)
  }

  public encode(): SequentialTaskState {
    return {
      t: "SequentialTask",
      s: this.startTime,
      childTaskStates: this.childTasks.map(task => task.encode())
    }
  }

  public static decode(state: SequentialTaskState, childTasks: CreepTask[]): SequentialTask {
    return new SequentialTask(state.s, childTasks)
  }

  public static create(childTasks: CreepTask[]): SequentialTask {
    return new SequentialTask(Game.time, childTasks)
  }

  public run(creep: V6Creep): CreepTaskProgress {
    const task = this.childTasks[0]
    if (task == null) {
      return CreepTaskProgress.Finished([])
    }
    return task.run(creep)
  }
}
