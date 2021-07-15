import { TaskLogRequest } from "application/task_logger"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

export class RoomKeeperLogAggregator {

  /**
   * @returns Aggregated logs
   */
  public execute(logs: TaskLogRequest[], roomResource: OwnedRoomResource): TaskLogRequest[] {
    return logs
  }
}
