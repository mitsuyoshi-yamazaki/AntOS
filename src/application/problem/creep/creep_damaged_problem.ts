import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"
import type { RoomName } from "shared/utility/room_name"

export class CreepDamagedProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public readonly shouldNotify = false

  public constructor(
    public readonly parentRoomName: RoomName,
    public readonly attackedRoomName: RoomName,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.attackedRoomName}`
  }
}
