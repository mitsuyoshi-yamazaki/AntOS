import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { CreepActions } from "os_v5/utility/game_object/creep_action"
import { SerializableObject } from "os_v5/utility/types"
import { AnyTask } from "../.."
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type SequentialState = {
  readonly t: TaskTypeEncodingMap["Sequential"]
  readonly c: SerializableObject[]
  readonly i?: true
}

export class Sequential extends Task<SequentialState> {
  public get actionType(): CreepActions | null {
    return this.childTasks[0]?.actionType ?? null
  }

  private constructor(
    public readonly childTasks: AnyTask[],
    public readonly ignoreFailure: true | undefined,
  ) {
    super()
  }

  public static create(childTasks: AnyTask[], ignoreFailure?: true): Sequential {
    return new Sequential(childTasks, ignoreFailure)
  }

  public encode(): SequentialState {
    return {
      t: "c",
      c: this.childTasks.map(task => task.encode()),
      i: this.ignoreFailure,
    }
  }

  public run(creep: AnyV5Creep): TaskResult {
    const currentTask = this.childTasks[0]
    if (currentTask == null) {
      return "finished"
    }

    const result = currentTask.run(creep)
    switch (result) {
    case "finished":
      break

    case "in progress":
      return "in progress"

    case "failed":
      if (this.ignoreFailure !== true) {
        return "failed"
      }
      break

    default:
      this.childTasks.unshift(result)
      break
    }

    this.childTasks.shift()

    const nextTask = this.childTasks[0]
    if (nextTask == null) {
      return "finished"
    }

    if (nextTask.canRun(creep) !== true) {
      return "in progress"
    }
    return this.run(creep)
  }
}
