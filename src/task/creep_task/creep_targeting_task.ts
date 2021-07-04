import { DecodeFailureTaskReasonUnknown } from "task/failure_task"
import { TaskTargetType } from "task/task"
import { CreepDecodeFailureTask, CreepTask, CreepTaskProgressType, CreepTaskState, decodeCreepTaskFromState } from "./creep_task"

export type CreepTargetingTaskFailureReason = "not in range" | string

export type CreepTargetingTaskTargetType = TaskTargetType
export type CreepTargetingTaskTargetTypeId = Id<CreepTargetingTaskTargetType>

export interface CreepTargetingTaskState extends CreepTaskState {
}

export abstract class CreepTargetingTask implements CreepTask<CreepTargetingTaskFailureReason> {
  public constructor(
    public readonly startTime: number,
    public readonly target: CreepTargetingTaskTargetType,
    public readonly targetId: CreepTargetingTaskTargetTypeId,
  ) { }

  abstract encode(): CreepTaskState
  abstract run(creep: Creep): CreepTaskProgressType<CreepTargetingTaskFailureReason>

  public static decode(state: CreepTargetingTaskState): CreepTargetingTask | CreepDecodeFailureTask {
    const decoded = decodeCreepTaskFromState(state)
    if (decoded instanceof CreepTargetingTask) {
      return decoded
    }
    if (decoded instanceof CreepDecodeFailureTask) {
      return decoded
    }
    return new CreepDecodeFailureTask(state.t, state.s, new DecodeFailureTaskReasonUnknown())
  }
}
