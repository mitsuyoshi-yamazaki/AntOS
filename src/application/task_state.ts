import { State } from "os/infrastructure/state"
import { RoomName } from "utility/room_name"
import type { TaskType } from "./task_decoder"

export interface TaskState extends State {
  /** task type identifier */
  t: TaskType

  /** start time */
  s: number

  /** room name */
  r: RoomName

  /** paused */
  p: number | null
}
