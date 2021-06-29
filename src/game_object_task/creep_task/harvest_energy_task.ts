import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { getCachedPathFor } from "script/pathfinder"

export interface HarvestEnergyTaskState extends CreepTaskState {
  /** target id */
  i: Id<Source>
}

export class HarvestEnergyTask implements CreepTask {
  public readonly shortDescription = "E-harvest"
  public get targetId(): Id<Source> {
    return this.source.id
  }

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
    // キャッシュされたroute to sourceがあればそれを使う
    const result = creep.harvest(this.source)

    switch (result) {
    case OK: {
      const harvestAmount = creep.body.filter(b => b.type === WORK).length * HARVEST_POWER
      if (creep.store.getFreeCapacity() <= harvestAmount) {
        return "finished"
      } else {
        this.move(creep)
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
    const cachedPath = getCachedPathFor(this.source)
    if (cachedPath == null) {
      creep.moveTo(this.source, { reusePath: 0 })
      return
    }
    const result = creep.moveByPath(cachedPath)
    switch (result) {
    case OK:
      return

    case ERR_INVALID_ARGS:
      creep.say("invl args")
      return

    case ERR_NOT_FOUND:
      creep.moveTo(creep.pos.findClosestByRange(cachedPath) ?? cachedPath[0])
      return

    case ERR_NOT_OWNER:
    case ERR_NO_BODYPART:
      creep.say(`E-${result}`)
      return

    case ERR_TIRED:
    case ERR_BUSY:
    default:
      return
    }
  }
}
