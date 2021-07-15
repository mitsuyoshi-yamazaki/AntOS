import { Problem } from "application/problem"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

export class RoomKeeperProblemSolver {

  /**
   * @returns Unresolved problems
   */
  public execute(problems: Problem[], roomResource: OwnedRoomResource): Problem[] {
    return []
  }
}
