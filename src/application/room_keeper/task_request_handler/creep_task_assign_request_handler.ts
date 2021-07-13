import { CreepTaskAssignTaskRequest } from "application/task_request"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

export class CreepTaskAssignRequestHandler {

  /**
   * @returns Unresolved requests
   */
  public execute(creepTaskAssignRequests: CreepTaskAssignTaskRequest[], roomResource: OwnedRoomResource): CreepTaskAssignTaskRequest[] {
    return []
  }
}
