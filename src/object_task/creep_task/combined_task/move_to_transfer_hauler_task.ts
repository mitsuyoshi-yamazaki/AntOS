import { defaultMoveToOptions, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, interRoomMoveToOptions } from "prototype/creep"
import { TaskProgressType } from "object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { TransferEnergyApiWrapper, TransferEnergyApiWrapperState, TransferEnergyApiWrapperTargetType } from "../api_wrapper/transfer_energy_api_wrapper"
import { World } from "world_info/world_info"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

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
    public readonly startTime: number,
    private readonly apiWrapper: TransferEnergyApiWrapper,
  ) {
    this.shortDescription = apiWrapper.shortDescription
  }

  public encode(): MoveToTransferHaulerTaskState {
    return {
      s: this.startTime,
      t: "MoveToTransferHaulerTask",
      as: this.apiWrapper.encode(),
    }
  }

  public static decode(state: MoveToTransferHaulerTaskState): MoveToTransferHaulerTask | null {
    const wrapper = TransferEnergyApiWrapper.decode(state.as)
    if (wrapper == null) {
      return null
    }
    return new MoveToTransferHaulerTask(state.s, wrapper)
  }

  public static create(apiWrapper: TransferEnergyApiWrapper): MoveToTransferHaulerTask {
    return new MoveToTransferHaulerTask(Game.time, apiWrapper)
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
      const options = creep.pos.roomName === this.apiWrapper.target.pos.roomName ? defaultMoveToOptions : interRoomMoveToOptions
      creep.moveTo(this.apiWrapper.target, options)
      this.runSubTask(creep)
      return TaskProgressType.InProgress
    }

    case ERR_BUSY:
      return TaskProgressType.InProgress

    case ERR_PROGRAMMING_ERROR:
      return TaskProgressType.Finished
    }
  }

  private runSubTask(creep: Creep): void {
    if (creep.body.map(b => b.type).includes(WORK) === true) {
      const roadToRepair = creep.pos.lookFor(LOOK_STRUCTURES).find(structure => {
        if (structure.structureType !== STRUCTURE_ROAD) {
          return false
        }
        if (structure.hits > structure.hitsMax * 0.85) {
          return false
        }
        return true
      }) as StructureRoad | null
      if (roadToRepair != null) {
        creep.repair(roadToRepair)
        return
      }
    }
    this.chargeNearbyChargeableStructure(creep)
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
