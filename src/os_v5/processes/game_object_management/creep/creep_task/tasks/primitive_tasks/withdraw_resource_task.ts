import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type Target = StructureStorage | StructureTerminal | StructureContainer
type WithdrawResourceState = {
  readonly t: TaskTypeEncodingMap["WithdrawResource"]
  readonly tg: Id<Target>
  readonly r: ResourceConstant
  readonly a?: number
}

export type WithdrawResourceResult = void
export type WithdrawResourceError = Exclude<ReturnType<Creep["withdraw"]>, OK> | "no_target"


export class WithdrawResource extends Task<WithdrawResourceState, WithdrawResourceResult, WithdrawResourceError> {
  public readonly actionType = "withdraw"

  private constructor(
    public readonly targetId: Id<Target>,
    public readonly resourceType: ResourceConstant,
    public readonly amount: number | undefined,
  ) {
    super()
  }

  public static decode(state: WithdrawResourceState): WithdrawResource {
    return new WithdrawResource(state.tg, state.r, state.a)
  }

  public static create(targetId: Id<Target>, resourceType: ResourceConstant, options?: {amount?: number}): WithdrawResource {
    return new WithdrawResource(targetId, resourceType, options?.amount)
  }

  public encode(): WithdrawResourceState {
    return {
      t: "h",
      tg: this.targetId,
      r: this.resourceType,
      a: this.amount,
    }
  }

  public run(creep: AnyV5Creep): TaskResult<WithdrawResourceResult, WithdrawResourceError> {
    const target = Game.getObjectById(this.targetId)
    if (target == null) {
      return {
        case: "failed",
        taskType: "WithdrawResource",
        error: "no_target",
      }
    }

    const result = creep.withdraw(target, this.resourceType, this.amount)
    if (result === OK) {
      creep.executedActions.add(this.actionType)
      return {
        case: "finished",
        taskType: "WithdrawResource",
        result: undefined,
      }
    }
    return {
      case: "failed",
      taskType: "WithdrawResource",
      error: result,
    }
  }
}
