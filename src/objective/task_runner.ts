import { OwnedRoomObjects } from "world_info/room_info"

export type TaskRunnerIdentifier = string

export interface TaskRunner {
  taskRunnerIdentifier: TaskRunnerIdentifier

  run(objects: OwnedRoomObjects): void
}
