import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

type HealTaskTarget = Creep

export interface HealTaskState extends CreepTaskState {
  /** target id */
  i: Id<HealTaskTarget>
}

export class HealTask implements CreepTask {
  // public readonly shortDescription = "heal"  // 見ればわかる
  public get targetId(): Id<HealTaskTarget> {
    return this.target.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly target: HealTaskTarget,
  ) { }

  public encode(): HealTaskState {
    return {
      s: this.startTime,
      t: "HealTask",
      i: this.target.id
    }
  }

  public static decode(state: HealTaskState): HealTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new HealTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    creep.memory.tt = Game.time
    const result = creep.heal(this.target)

    switch (result) {
    case OK:
      return "finished"

    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.target, { reusePath: 0 })
      return "in progress"

    case ERR_NOT_OWNER:
      return "failed"

    case ERR_INVALID_TARGET:
      PrimitiveLogger.fatal(`creep.heal() returns ERR_INVALID_TARGET, creep: ${creep.name}, target: ${this.target.id}`)
      return "failed"

    case ERR_NO_BODYPART:
    case ERR_BUSY:
    default:
      return "finished"
    }
  }
}
