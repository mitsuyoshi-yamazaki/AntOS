import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { EnergyStore } from "prototype/room_object"
import { isResourceConstant } from "utility/resource"

type WithdrawApiWrapperResult = FINISHED | IN_PROGRESS | FINISHED_AND_RAN | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_PROGRAMMING_ERROR
export type WithdrawApiWrapperTargetType = EnergyStore | Ruin | StructureLab | StructureFactory | StructureLink | StructureExtension | StructureSpawn | StructureTower

export interface WithdrawApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<WithdrawApiWrapperTargetType>
}

export class WithdrawApiWrapper implements ApiWrapper<Creep, WithdrawApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription: string
  public readonly range = 1

  private constructor(
    public readonly target: WithdrawApiWrapperTargetType,
  ) {
    if (this.target instanceof Resource) {
      this.shortDescription = "pickup"
    } else {
      this.shortDescription = "withdraw"
    }
  }

  public encode(): WithdrawApiWrapperState {
    return {
      t: "WithdrawApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: WithdrawApiWrapperState): WithdrawApiWrapper | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new WithdrawApiWrapper(source)
  }

  public static create(target: WithdrawApiWrapperTargetType): WithdrawApiWrapper {
    return new WithdrawApiWrapper(target)
  }

  public run(creep: Creep): WithdrawApiWrapperResult {
    if (creep.store.getFreeCapacity() <= 0) {
      return FINISHED
    }

    const result = (() => {
      if (this.target instanceof Resource) {
        return creep.pickup(this.target)
      }
      if (this.target instanceof StructureLab) {
        if (this.target.mineralType == null) {
          return creep.withdraw(this.target, RESOURCE_ENERGY)
        }
        return creep.withdraw(this.target, this.target.mineralType)
      }
      const resourceType = Object.keys(this.target.store)[0]
      if (resourceType == null || !isResourceConstant(resourceType)) {
        return ERR_NOT_ENOUGH_RESOURCES
      }
      if (this.target instanceof Creep) {
        return this.target.transfer(creep, resourceType) // TODO: 動くか確認
      }
      if (this.target instanceof PowerCreep) {
        return this.target.transfer(creep, resourceType) // TODO: 動くか確認
      }
      return creep.withdraw(this.target, resourceType)
    })()

    switch (result) {
    case OK:
      return IN_PROGRESS

    case ERR_FULL:
    case ERR_NOT_ENOUGH_RESOURCES:
      return FINISHED

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_INVALID_TARGET:
      if ((this.target instanceof Ruin) && this.target.structure.structureType === STRUCTURE_POWER_BANK) {
        return FINISHED // 対処療法
      }
      PrimitiveLogger.fatal(`WithdrawApiWrapper received ${result}, ${creep.name} in ${roomLink(creep.room.name)}, target: ${this.target}`)
      return ERR_PROGRAMMING_ERROR

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
    default:
      PrimitiveLogger.fatal(`WithdrawApiWrapper received ${result}, ${creep.name} in ${roomLink(creep.room.name)}, target: ${this.target}`)
      return ERR_PROGRAMMING_ERROR
    }
  }
}
