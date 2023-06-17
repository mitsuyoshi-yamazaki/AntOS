import { defaultMoveToOptions, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, interRoomMoveToOptions } from "prototype/creep"
import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { TransferEnergyApiWrapper, TransferEnergyApiWrapperState, TransferEnergyApiWrapperTargetType } from "../api_wrapper/transfer_energy_api_wrapper"
import { World } from "world_info/world_info"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { GameConstants } from "utility/constants"

export interface MoveToTransferHaulerTaskState extends CreepTaskState {
  /** api warpper state */
  as: TransferEnergyApiWrapperState
}

export class MoveToTransferHaulerTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<TransferEnergyApiWrapperTargetType> {
    return this.apiWrapper.target.id
  }

  private constructor(
    private readonly apiWrapper: TransferEnergyApiWrapper,
  ) {
    this.shortDescription = apiWrapper.shortDescription
  }

  public encode(): MoveToTransferHaulerTaskState {
    return {
      t: "MoveToTransferHaulerTask",
      as: this.apiWrapper.encode(),
    }
  }

  public static decode(state: MoveToTransferHaulerTaskState): MoveToTransferHaulerTask | null {
    const wrapper = TransferEnergyApiWrapper.decode(state.as)
    if (wrapper == null) {
      return null
    }
    return new MoveToTransferHaulerTask(wrapper)
  }

  public static create(apiWrapper: TransferEnergyApiWrapper): MoveToTransferHaulerTask {
    return new MoveToTransferHaulerTask(apiWrapper)
  }

  public run(creep: Creep): TaskProgressType {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      return TaskProgressType.Finished
    }

    const result = this.apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
      return TaskProgressType.Finished

    case FINISHED_AND_RAN:
      return TaskProgressType.FinishedAndRan

    case ERR_NOT_IN_RANGE: {
      const { isRepairing } = this.runSubTask(creep)
      const isMyRoom = creep.room.controller?.owner?.username === Game.user.name
      if (isRepairing !== true || isMyRoom === true) {
        const options = creep.pos.roomName === this.apiWrapper.target.pos.roomName ? defaultMoveToOptions() : interRoomMoveToOptions()
        creep.moveTo(this.apiWrapper.target, options)
      }
      return TaskProgressType.InProgress
    }

    case ERR_BUSY:
      return TaskProgressType.InProgress

    case ERR_PROGRAMMING_ERROR:
      return TaskProgressType.Finished
    }
  }

  private runSubTask(creep: Creep): {isRepairing: boolean} {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      return { isRepairing: false}
    }

    this.chargeNearbyChargeableStructure(creep)

    const repairPower = creep.getActiveBodyparts(WORK) * GameConstants.creep.actionPower.repair
    if (repairPower <= 0) {
      return { isRepairing: false }
    }

    const roadToRepair = creep.pos.lookFor(LOOK_STRUCTURES).find(structure => {
      if (structure.structureType !== STRUCTURE_ROAD) {
        return false
      }
      if (structure.hits > (structure.hitsMax - repairPower)) {
        return false
      }
      return true
    }) as StructureRoad | null

    if (roadToRepair == null) {
      return { isRepairing: false }
    }

    creep.repair(roadToRepair)
    const isRepairing = ((roadToRepair.hits + repairPower) < roadToRepair.hitsMax) && (roadToRepair.hits < (roadToRepair.hitsMax * 0.6))
    return { isRepairing }
  }

  private chargeNearbyChargeableStructure(creep: Creep): void {
    const objects = World.rooms.getOwnedRoomObjects(creep.room.name)
    if (objects == null) {
      return
    }
    const chargeableStructures = creep.pos.findInRange(objects.activeStructures.chargeableStructures, 1)
    chargeableStructures.forEach(structure => {
      const result = creep.transfer(structure, RESOURCE_ENERGY)
      if (result !== OK) {
        PrimitiveLogger.log(`${this.constructor.name} creep.transfer() to ${structure} returns ${result} in ${roomLink(creep.room.name)}`)
      }
    })
  }
}
