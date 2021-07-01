import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

export type AttackTaskTarget = Creep | AnyStructure

export interface AttackTaskState extends CreepTaskState {
  /** target id */
  i: Id<AttackTaskTarget>
}

export class AttackTask implements CreepTask {
  public readonly shortDescription = "attack"
  public get targetId(): Id<AttackTaskTarget> {
    return this.target.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly target: AttackTaskTarget,
  ) { }

  public encode(): AttackTaskState {
    return {
      s: this.startTime,
      t: "AttackTask",
      i: this.target.id,
    }
  }

  public static decode(state: AttackTaskState): AttackTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new AttackTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    creep.memory.tt = Game.time
    const result = creep.attack(this.target)

    switch (result) {
    case OK:
      creep.moveTo(this.target.pos)
      return "in progress"

    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.target, { reusePath: 0 })
      creep.heal(creep)
      return "in progress"

    case ERR_NOT_OWNER:
      return "failed"

    case ERR_INVALID_TARGET:
      PrimitiveLogger.fatal(`creep.attack() returns ERR_INVALID_TARGET, creep: ${creep.name}, target: ${this.target.id}`)
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
