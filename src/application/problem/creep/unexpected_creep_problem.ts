import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"
import type { RoomName } from "utility/room_name"
import type { CreepApiWrapperType } from "object_task/creep_task/creep_api_wrapper"

export class UnexpectedCreepProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly parentRoomName: RoomName,
    public readonly roomName: RoomName,
    public readonly apiType: CreepApiWrapperType,
    public readonly rawError: ScreepsReturnCode,
  ) {
    this.identifier = `${this.constructor.name}_${this.apiType}_${this.parentRoomName}_${this.roomName}_${this.rawError}`
  }
}
