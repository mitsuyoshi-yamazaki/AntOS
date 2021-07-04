import { CreepTask, CreepTaskState, decodeCreepTaskFromState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

export interface SequentialTaskOptions {
  /** ignore child task error */
  i: boolean
}

export interface SequentialTaskState extends CreepTaskState {
  /** child task states */
  c: CreepTaskState[]

  /** options */
  o: SequentialTaskOptions
}

export class SequentialTask implements CreepTask {
  public readonly shortDescription = "seq"
  // public get targetId(): Id<> {  // TODO:
  //   return
  // }

  public constructor(
    public readonly startTime: number,
    public readonly childTasks: CreepTask[],
    public readonly options: SequentialTaskOptions,
  ) { }

  public encode(): SequentialTaskState {
    return {
      s: this.startTime,
      t: "SequentialTask",
      c: this.childTasks.map(child => child.encode()),
      o: this.options,
    }
  }

  public static decode(state: SequentialTaskState): SequentialTask | null {
    const children: CreepTask[] = []
    for (const childState of state.c) {
      const child = decodeCreepTaskFromState(childState)
      if (child == null) {
        PrimitiveLogger.fatal(`Failed to decode creep task ${childState.t}`)
        return null
      }
      children.push(child)
    }
    return new SequentialTask(state.s, children, state.o)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    const currentTask = this.childTasks[0]
    if (currentTask == null) {
      return "finished"
    }

    const result = currentTask.run(creep)

    switch (result) {
    case "in progress":
      return "in progress"
    case "finished":
      this.childTasks.shift()
      return "in progress"
    case "failed":
      if (this.options.i === true) {
        this.childTasks.shift()
        return "in progress"
      }
      return "failed"
    }
  }
}
