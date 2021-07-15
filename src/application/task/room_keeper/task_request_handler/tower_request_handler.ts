import { TowerActionTaskRequest } from "application/task_request"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

export class TowerRequestHandler {

  /**
   * @returns Unresolved problems
   */
  public execute(towerRequests: TowerActionTaskRequest[], roomResource: OwnedRoomResource): TowerActionTaskRequest[] {
    return []
  }
}
