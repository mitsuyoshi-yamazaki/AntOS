import { Problem } from "application/problem"
import { State, Stateful } from "os/infrastructure/state"
import type { TaskTargetCacheTaskType, TaskTargetTypeId } from "./object_task_target_cache"

export interface TaskProgress {
  progress: "finished" | "in progress"
  problems: Problem[]
}
export const TaskProgress = {
  InProgress(problems: Problem[]): TaskProgress {
    return {
      progress: "in progress",
      problems,
    }
  },
  Finished(problems: Problem[]): TaskProgress {
    return {
      progress: "finished",
      problems,
    }
  },
}

export interface ObjectTaskTarget {
  targetId: TaskTargetTypeId
  taskTypes: TaskTargetCacheTaskType[]
}

export interface ObjectTaskState extends State {
  /** type identifier */
  t: string

  /** start time */
  s: number
}

export interface ObjectTask<ObjectType> extends Stateful {
  targets: ObjectTaskTarget[]
  startTime: number

  encode(): ObjectTaskState
  run(obj: ObjectType): TaskProgress
}
