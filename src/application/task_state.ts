import { State } from "os/infrastructure/state"
import type { RoomName } from "utility/room_name"
import type { Timestamp } from "utility/timestamp"
import type { TaskType } from "./task_decoder"
import type { TaskPerformanceState } from "./task_profit"

export interface TaskState extends State {
  /** task type identifier */
  readonly t: TaskType

  /** start time */
  readonly s: Timestamp

  /** session start time */
  readonly ss: Timestamp

  /** room name */
  readonly r: RoomName

  /** performance */
  readonly pf: TaskPerformanceState
}
