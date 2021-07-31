import { Problem } from "application/problem"
import { State, Stateful } from "os/infrastructure/state"
import { V6Creep } from "prototype/creep"
import type { TaskTarget } from "./object_task_target_cache"

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

export interface ObjectTaskState extends State {
  /** type identifier */
  t: string

  /** start time */
  s: number
}

export interface ObjectTask<ObjectType> extends Stateful {
  startTime: number

  encode(): ObjectTaskState
  taskTargets(creep: V6Creep): TaskTarget[]
  run(obj: ObjectType): TaskProgress
}
