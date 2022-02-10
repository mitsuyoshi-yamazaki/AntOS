import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { EnergyStore } from "prototype/room_object"

type GetEnergyApiWrapperResult = FINISHED | FINISHED_AND_RAN | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR
type GetEnergyApiWrapperTargetType = EnergyStore | StructureLink

export interface GetEnergyApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<GetEnergyApiWrapperTargetType>
}

export class GetEnergyApiWrapper implements ApiWrapper<Creep, GetEnergyApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription: string
  public readonly range = 1

  private constructor(
    public readonly target: GetEnergyApiWrapperTargetType,
  ) {
    if (this.target instanceof Resource) {
      this.shortDescription = "pickup"
    } else {
      this.shortDescription = "withdraw"
    }
  }

  public encode(): GetEnergyApiWrapperState {
    return {
      t: "GetEnergyApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: GetEnergyApiWrapperState): GetEnergyApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new GetEnergyApiWrapper(source)
  }

  public static create(target: GetEnergyApiWrapperTargetType): GetEnergyApiWrapper {
    return new GetEnergyApiWrapper(target)
  }

  public run(creep: Creep): GetEnergyApiWrapperResult {
    const result = (() => {
      if (this.target instanceof Resource) {
        return creep.pickup(this.target)
      }
      if (this.target instanceof Creep) {
        return this.target.transfer(creep, RESOURCE_ENERGY) // TODO: 動くか確認
      }
      if (this.target instanceof PowerCreep) {
        return this.target.transfer(creep, RESOURCE_ENERGY) // TODO: 動くか確認
      }
      return creep.withdraw(this.target, RESOURCE_ENERGY)
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
      PrimitiveLogger.fatal(`GetEnergyApiWrapper received ${result}, ${creep.name} in ${roomLink(creep.room.name)}, target: ${this.target}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
