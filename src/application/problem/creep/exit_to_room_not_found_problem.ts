import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"
import type { RoomName } from "utility/room_name"

export class ExitToRoomNotFoundProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly position: RoomPosition,
    public readonly destinationRoom: RoomName
  ) {
    this.identifier = `${this.constructor.name}_${this.position.id}_${this.destinationRoom}`
  }
}
