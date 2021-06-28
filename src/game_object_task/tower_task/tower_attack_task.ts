import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { StructureTowerTask, StructureTowerTaskState } from "game_object_task/tower_task"

export interface AttackTaskState extends StructureTowerTaskState {
  /** target id */
  i: Id<Creep>
}

export class AttackTask implements StructureTowerTask {
  public readonly taskType = "AttackTask"

  public get targetId(): Id<Creep> {
    return this.target.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly target: Creep,
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

  public run(tower: StructureTower): GameObjectTaskReturnCode {
    return "in progress"  // TODO:
  }
}
