import { Problem } from "application/problem"
import type { ProblemIdentifier } from "application/problem"
import { CreepApiWrapperType } from "object_task/creep_task/creep_api_wrapper_decoder"
import type { RoomName } from "shared/utility/room_name_types"

export class MissingTargetStructureProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public readonly shouldNotify = true

  public constructor(
    public readonly parentRoomName: RoomName,
    public readonly roomName: RoomName,
    public readonly structureType: StructureConstant,
    public readonly apiType: CreepApiWrapperType,
  ) {
    this.identifier = `${this.constructor.name}_${this.apiType}_${this.parentRoomName}_${this.roomName}_${this.structureType}`
  }
}
