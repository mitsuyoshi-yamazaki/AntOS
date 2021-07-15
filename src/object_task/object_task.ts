import { Problem } from "application/problem"
import { State, Stateful } from "os/infrastructure/state"
import type { TaskTargetTypeId } from "v5_object_task/object_task_target_cache"

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
  targetId?: TaskTargetTypeId
  startTime: number

  encode(): ObjectTaskState
  run(obj: ObjectType): TaskProgress
}
