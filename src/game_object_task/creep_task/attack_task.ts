import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"

type AttackTaskTarget = Creep | AnyStructure

export interface AttackTaskState extends CreepTaskState {
  /** target id */
  i: Id<AttackTaskTarget>
}

export class AttackTask implements CreepTask {
  public readonly shortDescription = "build"
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
    creep.heal(creep)

    switch (result) {
    case OK: {
      return "in progress"
    }
    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.target, { reusePath: 0 })
      return "in progress"
    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
      return "failed"
    case ERR_NO_BODYPART:
    case ERR_BUSY:
    default:
      return "in progress"
    }
  }
}
