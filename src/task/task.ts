import { State, Stateful } from "os/infrastructure/state"
import { TaskTargetTypeId } from "./task_target_cache"

export type TaskProgressTypeFinishedAndRan = 0
export type TaskProgressTypeFinished = 1
export type TaskProgressTypeInProgress = 2

const taskProgressTypeFinishedAndRan: TaskProgressTypeFinishedAndRan = 0
const taskProgressTypeFinished: TaskProgressTypeFinished = 1
const taskProgressTypeInProgress: TaskProgressTypeInProgress = 2

export type TaskProgressType = TaskProgressTypeFinishedAndRan | TaskProgressTypeFinished | TaskProgressTypeInProgress
export const TaskProgressType = {
  FinishedAndRan: taskProgressTypeFinishedAndRan,
  Finished: taskProgressTypeFinished,
  InProgress: taskProgressTypeInProgress,
}

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
