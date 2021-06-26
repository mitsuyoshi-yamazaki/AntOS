import { GameObjectTask, GameObjectTaskState, GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface HarvestEnergyTaskState extends GameObjectTaskState {
  /** target id */
  i: Id<Source>
}

export class HarvestEnergyTask implements GameObjectTask<Creep> {
  public readonly taskType = "HarvestEnergyTask"
  public readonly shortDescription = "E-harvest"

  public constructor(
    public readonly startTime: number,
    public readonly source: Source,
  ) { }

  public encode(): HarvestEnergyTaskState {
    return {
      s: this.startTime,
      t: "HarvestEnergyTask",
      i: this.source.id,
    }
  }

  public static decode(state: HarvestEnergyTaskState): HarvestEnergyTask | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new HarvestEnergyTask(state.s, source)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    const result = creep.harvest(this.source)

    switch (result) {
    case OK: {
      const harvestAmount = creep.body.filter(b => b.type === WORK).length * HARVEST_POWER
      if (creep.store.getFreeCapacity() <= harvestAmount) {
        return "finished"
      }
      return "in progress"
    }

    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.source, { reusePath: 15 })
      return "in progress"

    case ERR_NOT_ENOUGH_RESOURCES:
      return "finished"

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    case ERR_NOT_FOUND:
    case ERR_TIRED:
      return "failed"

    case ERR_BUSY:
    default:
      return "in progress"
    }
  }
}
