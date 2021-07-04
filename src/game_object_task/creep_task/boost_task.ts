import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

export interface BoostTaskState extends CreepTaskState {
  /** lab id */
  i: Id<StructureLab>
}

export class BoostTask implements CreepTask {
  public readonly shortDescription = "boost"
  public get targetId(): Id<StructureLab> {
    return this.lab.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly lab: StructureLab,
  ) { }

  public encode(): BoostTaskState {
    return {
      s: this.startTime,
      t: "BoostTask",
      i: this.lab.id,
    }
  }

  public static decode(state: BoostTaskState): BoostTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new BoostTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    const result = this.lab.boostCreep(creep)

    switch (result) {
    case OK:
      return "finished"

    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.lab, { reusePath: 0 })
      return "in progress"

    case ERR_NOT_OWNER:
    case ERR_NOT_FOUND:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_RCL_NOT_ENOUGH:
      return "failed"

    case ERR_INVALID_TARGET:
      PrimitiveLogger.fatal(`lab.boostCreep() returns ERR_INVALID_TARGET, creep: ${creep.name}, lab: ${this.lab.id}`)
      creep.heal(creep)
      return "failed"

    default:
      return "in progress"
    }
  }
}
