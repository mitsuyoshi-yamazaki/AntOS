import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"
import type { RoomName } from "shared/utility/room_name_types"

export class MissingActiveStructureProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public readonly shouldNotify = true

  public constructor(
    public readonly roomName: RoomName,
    public readonly structureType: StructureConstant,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}_${this.structureType}`
  }
}
