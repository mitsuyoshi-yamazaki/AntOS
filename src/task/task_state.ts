import { State } from "os/infrastructure/state"
import { TaskType } from "./task_decoder"

export interface TaskState extends State {
  /** task type identifier */
  t: TaskType

  /** start time */
  s: number

  /** child task state */
  c: TaskState[]
}
