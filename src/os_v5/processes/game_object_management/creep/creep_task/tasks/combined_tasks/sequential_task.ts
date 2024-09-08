import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { CreepActions } from "os_v5/utility/game_object/creep_action"
import { SerializableObject } from "shared/utility/serializable_types"
import { AnyTask } from "../.."
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type SequentialState = {
  readonly t: TaskTypeEncodingMap["Sequential"]
  readonly c: SerializableObject[]
  readonly i?: true
}

export type SequentialResult = "all_tasks_finished" | string | number
export type SequentialError = string | number

export class Sequential extends Task<SequentialState, SequentialResult, SequentialError> {
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

  public run(creep: AnyV5Creep): TaskResult<SequentialResult, SequentialError> {
    const currentTask = this.childTasks[0]
    if (currentTask == null) {
      return {
        case: "finished",
        taskType: "Sequential",
        result: "all_tasks_finished",
      }
    }

    const result = currentTask.run(creep)
    switch (result.case) {
    case "finished":
      this.childTasks.shift()
      if (this.childTasks.length <= 0) {
        return result
      }
      break

    case "in_progress":
      return {
        case: "in_progress",
      }

    case "failed":
      if (this.ignoreFailure !== true) {
        return result
      }
      this.childTasks.shift()
      if (this.childTasks.length <= 0) {
        return result
      }
      break

    case "next_task":
      this.childTasks.shift()
      this.childTasks.unshift(result.task)
      break

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      break
    }
    }

    const nextTask = this.childTasks[0]
    if (nextTask == null) {
      return {
        case: "finished",
        taskType: "Sequential",
        result: "all_tasks_finished",
      }
    }

    if (nextTask.canRun(creep) !== true) {
      return {
        case: "in_progress",
      }
    }
    return this.run(creep)
  }
}
