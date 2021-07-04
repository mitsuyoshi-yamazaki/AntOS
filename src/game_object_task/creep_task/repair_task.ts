import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface RepairTaskState extends CreepTaskState {
  /** target id */
  i: Id<AnyOwnedStructure>
}

export class RepairTask implements CreepTask {
  public readonly shortDescription = "repair"
  public get targetId(): Id<AnyOwnedStructure> {
    return this.structure.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly structure: AnyOwnedStructure,
  ) { }

  public encode(): RepairTaskState {
    return {
      s: this.startTime,
      t: "RepairTask",
      i: this.structure.id,
    }
  }

  public static decode(state: RepairTaskState): RepairTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new RepairTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    const result = creep.repair(this.structure)

    switch (result) {
    case OK: {
      const consumeAmount = creep.body.filter(b => b.type === WORK).length * REPAIR_POWER
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= consumeAmount) {
        return "finished"
      }
      return "in progress"
    }
    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.structure, { reusePath: 0 })
      return "in progress"
    case ERR_NOT_ENOUGH_RESOURCES:
      return "finished"
    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
      return "failed"
    case ERR_BUSY:
    default:
      return "in progress"
    }
  }
}
