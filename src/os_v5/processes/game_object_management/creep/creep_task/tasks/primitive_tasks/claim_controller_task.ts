import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type ClaimControllerState = {
  readonly t: TaskTypeEncodingMap["ClaimController"]
  readonly c: Id<StructureController>
  readonly s?: string
}

export type ClaimControllerResult = void
export type ClaimControllerError = Exclude<ReturnType<Creep["claimController"]>, OK> | "no_controller"


export class ClaimController extends Task<ClaimControllerState, ClaimControllerResult, ClaimControllerError> {
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

  public run(creep: AnyV5Creep): TaskResult<ClaimControllerResult, ClaimControllerError> {
    const controller = Game.getObjectById(this.controllerId)
    if (controller == null) {
      return {
        case: "failed",
        taskType: "ClaimController",
        error: "no_controller",
      }
    }

    if (this.sign != null) {
      creep.signController(controller, this.sign)
    }

    const result = creep.claimController(controller)
    if (result === OK) {
      return {
        case: "finished",
        taskType: "ClaimController",
        result: undefined,
      }
    }

    return {
      case: "failed",
      taskType: "ClaimController",
      error: result,
    }
  }
}
