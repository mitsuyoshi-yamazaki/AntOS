import { OwnedRoomObjects } from "world_info/room_info"

export interface TaskRunner {
  run(objects: OwnedRoomObjects): void
}
