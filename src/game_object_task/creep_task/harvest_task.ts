import { GameObjectTask, GameObjectTaskState, GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface HarvestTaskState extends GameObjectTaskState {
  /** target id */
  i: Id<Source>
}

export class HarvestTask implements GameObjectTask<Creep> {
  public readonly taskType = "HarvestTask"

  public constructor(
    public readonly startTime: number,
    public readonly source: Source,
  ) { }

  public encode(): HarvestTaskState {
    return {
      s: this.startTime,
      t: "HarvestTask",
      i: this.source.id,
    }
  }

  public static decode(state: HarvestTaskState): HarvestTask | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new HarvestTask(state.s, source)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    if (creep.store.getFreeCapacity() <= 0) {
      return "finished"
    }

    const result = creep.harvest(this.source)
    switch (result) {
    case OK:
      return "in progress"
    default:
      creep.moveTo(this.source, { reusePath: 15 })
      return "in progress"
    }
  }
}
