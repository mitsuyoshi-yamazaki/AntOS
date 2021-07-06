import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { AttackTaskTarget } from "./attack_task"

type RangedAttackTaskTarget = AttackTaskTarget

export interface RangedAttackTaskState extends CreepTaskState {
  /** target id */
  i: Id<RangedAttackTaskTarget>
}

export class RangedAttackTask implements CreepTask {
  public readonly shortDescription = "r-attack"
  public get targetId(): Id<RangedAttackTaskTarget> {
    return this.target.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly target: RangedAttackTaskTarget,
  ) { }

  public encode(): RangedAttackTaskState {
    return {
      s: this.startTime,
      t: "RangedAttackTask",
      i: this.target.id,
    }
  }

  public static decode(state: RangedAttackTaskState): RangedAttackTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new RangedAttackTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    const result = creep.rangedAttack(this.target)
    creep.heal(creep)

    switch (result) {
    case OK:
      if (creep.pos.getRangeTo(this.target.pos) > 2) {
        creep.moveTo(this.target.pos)
      }
      return "in progress"

    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.target, { reusePath: 0 })
      creep.heal(creep)
      return "in progress"

    case ERR_NOT_OWNER:
      return "failed"

    case ERR_INVALID_TARGET:
      PrimitiveLogger.fatal(`creep.rangedAttack() returns ERR_INVALID_TARGET, creep: ${creep.name}, target: ${this.target.id}`)
      creep.heal(creep)
      return "failed"

    case ERR_NO_BODYPART:
      creep.heal(creep)
      return "in progress"

    case ERR_BUSY:
    default:
      return "in progress"
    }
  }
}
