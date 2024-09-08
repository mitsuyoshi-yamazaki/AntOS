import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type DropResourceState = {
  readonly t: TaskTypeEncodingMap["DropResource"]
  readonly r: ResourceConstant
  readonly a?: number
}

export type DropResourceResult = void
export type DropResourceError = Exclude<ReturnType<Creep["drop"]>, OK>


export class DropResource extends Task<DropResourceState, DropResourceResult, DropResourceError> {
  public readonly actionType = "drop"

  private constructor(
    public readonly resourceType: ResourceConstant,
    public readonly amount: number | undefined,
  ) {
    super()
  }

  public static decode(state: DropResourceState): DropResource {
    return new DropResource(state.r, state.a)
  }

  public static create(resourceType: ResourceConstant, options?: { amount?: number }): DropResource {
    return new DropResource(resourceType, options?.amount)
  }

  public encode(): DropResourceState {
    return {
      t: "i",
      r: this.resourceType,
      a: this.amount,
    }
  }

  public run(creep: AnyV5Creep): TaskResult<DropResourceResult, DropResourceError> {
    const result = creep.drop(this.resourceType, this.amount)
    if (result === OK) {
      creep.executedActions.add(this.actionType)
      return {
        case: "finished",
        taskType: "DropResource",
        result: undefined,
      }
    }
    return {
      case: "failed",
      taskType: "DropResource",
      error: result,
    }
  }
}
