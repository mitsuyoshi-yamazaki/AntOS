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
      this.move(creep)
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

  private move(creep: Creep): void {
    if (this.source.id === "59f19fb482100e1594f356f4") {
      this.moveByCachedPath(creep)
      return
    }
    creep.moveTo(this.source, { reusePath: 15 })
  }

  private moveByCachedPath(creep: Creep): void {
    const path = creep.room.find(FIND_FLAGS)
      .filter(flag => flag.color === COLOR_ORANGE)
      .map(flag => flag.pos)
    const result = creep.moveByPath(path)

    switch (result) {
    case OK:
      // creep.say("🏃‍♂️")
      return

    case ERR_INVALID_ARGS:
      creep.say("invl args")
      return

    case ERR_NOT_FOUND:
      creep.say("notonpath")
      creep.moveTo(creep.pos.findClosestByRange(path) ?? path[0])
      return

    case ERR_NOT_OWNER:
    case ERR_NO_BODYPART:
      creep.say(`E-${result}`)
      return

    case ERR_TIRED:
    case ERR_BUSY:
    default:
      creep.say("🏃‍♂️")
      return
    }
  }
}
