import { State, Stateful } from "os/infrastructure/state"
import type { TaskTargetTypeId } from "v5_object_task/object_task_target_cache"
import type { ApiError } from "./api_error"

export interface TaskProgress<Api, ObjectIdentifier> {
  progress: "finished" | "in progress"
  apiErrors: ApiError<Api, ObjectIdentifier>[]
}
export const TaskProgress = {
  InProgress<Api, ObjectIdentifier>(apiErrors: ApiError<Api, ObjectIdentifier>[]): TaskProgress<Api, ObjectIdentifier> {
    return {
      progress: "in progress",
      apiErrors,
    }
  },
  Finished<Api, ObjectIdentifier>(apiErrors: ApiError<Api, ObjectIdentifier>[]): TaskProgress<Api, ObjectIdentifier> {
    return {
      progress: "finished",
      apiErrors,
    }
  },
}

export interface ObjectTaskState extends State {
  /** type identifier */
  t: string

  /** start time */
  s: number
}

export interface ObjectTask<ObjectType, Api, ObjectIdentifier> extends Stateful {
  targetId?: TaskTargetTypeId
  startTime: number

  encode(): ObjectTaskState
  run(obj: ObjectType): TaskProgress<Api, ObjectIdentifier>
}
