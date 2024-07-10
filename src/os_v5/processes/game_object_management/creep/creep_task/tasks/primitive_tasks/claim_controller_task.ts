import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type ClaimControllerState = {
  readonly t: TaskTypeEncodingMap["ClaimController"]
  readonly c: Id<StructureController>
  readonly s?: string
}

export class ClaimController extends Task<ClaimControllerState> {
  public readonly actionType = null

  private constructor(
    public readonly controllerId: Id<StructureController>,
    public readonly sign: string | undefined
  ) {
    super()
  }

  public static decode(state: ClaimControllerState): ClaimController {
    return new ClaimController(state.c, state.s)
  }

  public static create(controllerId: Id<StructureController>, sign?: string): ClaimController { // signを消去するには空文字列を入れる
    return new ClaimController(controllerId, sign)
  }

  public encode(): ClaimControllerState {
    return {
      t: "d",
      c: this.controllerId,
      s: this.sign,
    }
  }

  public run(creep: AnyV5Creep): TaskResult {
    const controller = Game.getObjectById(this.controllerId)
    if (controller == null) {
      return "failed"
    }

    if (this.sign != null) {
      creep.signController(controller, this.sign)
    }

    const result = creep.claimController(controller)
    switch (result) {
    case OK:
      return "finished"

    case ERR_TIRED:
    case ERR_BUSY:
    case ERR_GCL_NOT_ENOUGH:
    case ERR_NOT_IN_RANGE:
    case ERR_FULL:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    case ERR_NOT_OWNER:
      return "failed"

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      return "failed"
    }
    }
  }
}
