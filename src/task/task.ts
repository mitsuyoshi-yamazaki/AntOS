import { State, Stateful } from "os/infrastructure/state"
import { TaskTargetTypeId } from "./task_target_cache"

export type TaskProgressTypeFinished = 0
export type TaskProgressTypeInProgress = 1

export const taskProgressTypeFinished: TaskProgressTypeFinished = 0
export const taskProgressTypeInProgress: TaskProgressTypeInProgress = 1

export type TaskProgressType = TaskProgressTypeFinished | TaskProgressTypeInProgress

export interface TaskState extends State {
  /** type identifier */
  t: string

  /** start time */
  s: number
}

/**
 * - in progress / finished の2値で表せるタスク
 */
export interface Task<ObjectType> extends Stateful {
  targetId?: TaskTargetTypeId
  startTime: number

  encode(): TaskState
  run(obj: ObjectType): TaskProgressType
}
