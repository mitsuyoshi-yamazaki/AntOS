import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface DismantleTaskState extends CreepTaskState {
  /** target id */
  i: Id<AnyStructure>
}

export class DismantleTask implements CreepTask {
  public readonly shortDescription = "dismantle"
  public get targetId(): Id<AnyStructure> {
    return this.target.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly target: AnyStructure,
  ) { }

  public encode(): DismantleTaskState {
    return {
      s: this.startTime,
      t: "DismantleTask",
      i: this.target.id,
    }
  }

  public static decode(state: DismantleTaskState): DismantleTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new DismantleTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    creep.memory.tt = Game.time
    const result = creep.dismantle(this.target)

    switch (result) {
    case OK: {
      if (creep.pos.x === 0) {
        creep.move(RIGHT)
      } else if (creep.pos.x === 49) {
        creep.move(LEFT)
      } else if (creep.pos.y === 0) {
        creep.move(BOTTOM)
      } else if (creep.pos.y === 49) {
        creep.move(TOP)
      }
      return "in progress"
    }
    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.target, { reusePath: 0 })
      return "in progress"
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
