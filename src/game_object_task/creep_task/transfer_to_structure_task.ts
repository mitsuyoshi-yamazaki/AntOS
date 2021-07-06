import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface TransferToStructureTaskState extends CreepTaskState {
  /** target id */
  i: Id<AnyStructure>
}

export class TransferToStructureTask implements CreepTask {
  public readonly shortDescription = "transfer"
  public get targetId(): Id<AnyStructure> {
    return this.structure.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly structure: AnyStructure,
  ) { }

  public encode(): TransferToStructureTaskState {
    return {
      s: this.startTime,
      t: "TransferToStructureTask",
      i: this.structure.id,
    }
  }

  public static decode(state: TransferToStructureTaskState): TransferToStructureTask | null {
    const structure = Game.getObjectById(state.i)
    if (structure == null) {
      return null
    }
    return new TransferToStructureTask(state.s, structure)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      return "finished"
    }

    const result = creep.transfer(this.structure, RESOURCE_ENERGY)
    switch (result) {
    case OK:
      return "in progress"
    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.structure, { reusePath: 0 })
      return "in progress"
    case ERR_FULL:
      return "finished"
    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
      return "failed"
    default:
      return "in progress"
    }
  }
}
