import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { EnergyStore } from "prototype/room_object"

type WithdrawResourceApiWrapperResult = FINISHED | FINISHED_AND_RAN | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR
type WithdrawResourceApiWrapperTargetType = EnergyStore | Ruin | StructureLab

export interface WithdrawResourceApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<WithdrawResourceApiWrapperTargetType>

  /** resource type */
  r: ResourceConstant

  amount: number | null
}

export class WithdrawResourceApiWrapper implements ApiWrapper<Creep, WithdrawResourceApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription: string
  public readonly range = 1

  private constructor(
    public readonly target: WithdrawResourceApiWrapperTargetType,
    public readonly resourceType: ResourceConstant,
    public readonly amount: number | null,
  ) {
    if (this.target instanceof Resource) {
      this.shortDescription = "pickup"
    } else {
      this.shortDescription = "withdraw"
    }
  }

  public encode(): WithdrawResourceApiWrapperState {
    return {
      t: "WithdrawResourceApiWrapper",
      i: this.target.id,
      r: this.resourceType,
      amount: this.amount,
    }
  }

  public static decode(state: WithdrawResourceApiWrapperState): WithdrawResourceApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new WithdrawResourceApiWrapper(source, state.r, state.amount ?? null)
  }

  public static create(target: WithdrawResourceApiWrapperTargetType, resourceType: ResourceConstant, amount?: number): WithdrawResourceApiWrapper {
    return new WithdrawResourceApiWrapper(target, resourceType, amount ?? null)
  }

  public run(creep: Creep): WithdrawResourceApiWrapperResult {
    const result = (() => {
      if (this.target instanceof Resource) {
        return creep.pickup(this.target)
      }
      if (this.target instanceof Creep) {
        return this.target.transfer(creep, this.resourceType) // TODO: 動くか確認
      }
      if (this.target instanceof PowerCreep) {
        return this.target.transfer(creep, this.resourceType) // TODO: 動くか確認
      }
      return creep.withdraw(this.target, this.resourceType, this.amount ?? undefined)
    })()

    switch (result) {
    case OK:
      return FINISHED_AND_RAN

    case ERR_FULL:
    case ERR_NOT_ENOUGH_RESOURCES:
      return FINISHED

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_INVALID_ARGS:
    default:
      PrimitiveLogger.fatal(`WithdrawResourceApiWrapper received ${result}, ${creep.name} in ${roomLink(creep.room.name)}, target: ${this.target}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
