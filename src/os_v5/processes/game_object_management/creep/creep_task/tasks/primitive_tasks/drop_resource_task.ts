import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type DropResourceState = {
  readonly t: TaskTypeEncodingMap["DropResource"]
  readonly r: ResourceConstant
  readonly a?: number
}

export class DropResource extends Task<DropResourceState> {
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

  public run(creep: AnyV5Creep): TaskResult {
    if (creep.drop(this.resourceType, this.amount) === OK) {
      creep.executedActions.add(this.actionType)
      return "finished"
    }
    return "failed"
  }
}
