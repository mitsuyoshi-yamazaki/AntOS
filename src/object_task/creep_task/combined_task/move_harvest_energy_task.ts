import { defaultMoveToOptions, ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { getCachedPathFor } from "script/pathfinder"
import { TaskProgressType } from "object_task/object_task"
import { HarvestEnergyApiWrapper } from "../api_wrapper/harvest_energy_api_wrapper"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface MoveHarvestEnergyTaskState extends CreepTaskState {
  /** source ID */
  i: Id<Source>
}

/** @deprecated */
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
    case FINISHED_AND_RAN:
      return TaskProgressType.FinishedAndRan

    case IN_PROGRESS:
    case ERR_NOT_IN_RANGE:
      this.move(creep)
      return TaskProgressType.InProgress

    case ERR_NOT_ENOUGH_RESOURCES:
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) >= creep.store.getCapacity() * 0.6) {
        return TaskProgressType.Finished
      }
      this.move(creep)
      return TaskProgressType.InProgress

    case ERR_BUSY:
      return TaskProgressType.InProgress

    case ERR_DAMAGED:
      return TaskProgressType.Finished

    case ERR_PROGRAMMING_ERROR:
      return TaskProgressType.Finished
    }
  }

  private move(creep: Creep): void {
    const cachedPath = getCachedPathFor(this.apiWrapper.source)
    if (cachedPath == null) {
      creep.moveTo(this.apiWrapper.source, defaultMoveToOptions)
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
      creep.moveTo((creep.pos.findClosestByRange(cachedPath) ?? cachedPath[0]), defaultMoveToOptions)
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
