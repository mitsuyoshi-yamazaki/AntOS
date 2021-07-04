import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, IN_PROGRESS } from "prototype/creep"
import { getCachedPathFor } from "script/pathfinder"
import { TaskProgressType, taskProgressTypeFinished, taskProgressTypeInProgress } from "task/task"
import { HarvestEnergyApiWrapper } from "../api_wrapper/harvest_energy_api_wrapper"
import { CreepTask, CreepTaskState } from "../creep_task"

export interface MoveHarvestEnergyTaskState extends CreepTaskState {
  /** source ID */
  i: Id<Source>
}

export class MoveHarvestEnergyTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<Source> {
    return this.apiWrapper.source.id
  }

  private readonly apiWrapper: HarvestEnergyApiWrapper

  private constructor(
    public readonly startTime: number,
    source: Source,
  ) {
    this.apiWrapper = HarvestEnergyApiWrapper.create(source)
    this.shortDescription = this.apiWrapper.shortDescription
  }

  public encode(): MoveHarvestEnergyTaskState {
    return {
      s: this.startTime,
      t: "MoveHarvestEnergyTask",
      i: this.apiWrapper.source.id,
    }
  }

  public static decode(state: MoveHarvestEnergyTaskState): MoveHarvestEnergyTask | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new MoveHarvestEnergyTask(state.s, source)
  }

  public static create(source: Source): MoveHarvestEnergyTask {
    return new MoveHarvestEnergyTask(Game.time, source)
  }

  public run(creep: Creep): TaskProgressType {
    const result = this.apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
      return taskProgressTypeFinished

    case IN_PROGRESS:
    case ERR_NOT_IN_RANGE:
      this.move(creep)
      return taskProgressTypeInProgress

    case ERR_NOT_ENOUGH_RESOURCES:
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity() * 0.6) {
        return taskProgressTypeFinished
      }
      this.move(creep)
      return taskProgressTypeInProgress

    case ERR_BUSY:
      return taskProgressTypeInProgress

    case ERR_DAMAGED:
      return taskProgressTypeFinished

    case ERR_PROGRAMMING_ERROR:
      return taskProgressTypeFinished
    }
  }

  private move(creep: Creep): void {
    const cachedPath = getCachedPathFor(this.apiWrapper.source)
    if (cachedPath == null) {
      creep.moveTo(this.apiWrapper.source, { reusePath: 0 })
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
