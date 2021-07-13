import { SpawnTaskRequest } from "application/task_request"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

export class SpawnRequestHandler {

  /**
   * @returns Unresolved problems
   */
  public execute(spawnRequests: SpawnTaskRequest[], roomResource: OwnedRoomResource): SpawnTaskRequest[] {
    return []
  }
}
