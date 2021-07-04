import { ERR_PROGRAMMING_ERROR } from "prototype/creep"
import { DecodeFailureTask, DecodeFailureTaskReasonTargetNotFound } from "task/failure_task"
import { TaskFailed, TaskInProgress } from "task/task"
import { CreepDecodeFailureTask, CreepTask, CreepTaskProgressType, CreepTaskState } from "../creep_task"

export interface MoveHarvestEnergyTaskState extends CreepTaskState {
  /** target id */
  i: Id<Source>

  /**  */
}

export class MoveHarvestEnergyTask implements CreepTask<MoveHarvestEnergyTaskFailedReason> {
  public readonly shortDescription = "E-harvest"
  public get targetId(): Id<Source> {
    return this.source.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly source: Source,
  ) { }

  public encode(): MoveHarvestEnergyTaskState {
    return {
      s: this.startTime,
      t: "MoveHarvestEnergyTask",
      i: this.source.id,
    }
  }

  public static decode(state: MoveHarvestEnergyTaskState): MoveHarvestEnergyTask | CreepDecodeFailureTask {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return new DecodeFailureTask(state.t, state.s, new DecodeFailureTaskReasonTargetNotFound(state.i))
    }
    return new MoveHarvestEnergyTask(state.s, source)
  }

  public run(creep: Creep): CreepTaskProgressType<MoveHarvestEnergyTaskFailedReason> {
    const result = creep.harvest(this.source)

    switch (result) {
    case OK:
      return new TaskInProgress(undefined)

    case ERR_NOT_IN_RANGE:
      return new TaskFailed(ERR_NOT_IN_RANGE)

    case ERR_NOT_ENOUGH_RESOURCES:
      return new TaskFailed(ERR_NOT_ENOUGH_RESOURCES)

    case ERR_BUSY:
      return new TaskFailed(ERR_BUSY)

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    case ERR_NOT_FOUND:
    case ERR_TIRED:
    default:
      return new TaskFailed(ERR_PROGRAMMING_ERROR)
    }
  }
}
