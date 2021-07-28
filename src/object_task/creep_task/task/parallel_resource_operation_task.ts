import type { TaskTarget } from "object_task/object_task_target_cache"
import { isResourceOperationApiWrapper, ResourceOperationApiWrapper } from "object_task/resource_operation_api_wrapper"
import { isTargetingApiWrapper, TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import type { V6Creep } from "prototype/creep"
import { CreepApiWrapper, CreepApiWrapperState } from "../creep_api_wrapper"
import { decodeCreepApiWrapperFromState } from "../creep_api_wrapper_decoder"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { MoveToPositionTask } from "./move_to_position_task"

type ApiWrapperType = CreepApiWrapper & TargetingApiWrapper & ResourceOperationApiWrapper
type ApiWrapperState = CreepApiWrapperState

export interface ParallelResourceOperationTaskOptions {
}

export interface ParallelResourceOperationTaskState extends CreepTaskState {
  /** type identifier */
  t: "ParallelResourceOperationTask"

  apiWrapperStates: ApiWrapperState[]
}

export class ParallelResourceOperationTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    private readonly apiWrappers: ApiWrapperType[],
  ) {
    this.shortDescription = apiWrappers[0]?.resourceOperationDescription ?? ""
  }

  public encode(): ParallelResourceOperationTaskState {
    return {
      t: "ParallelResourceOperationTask",
      s: this.startTime,
      apiWrapperStates: this.apiWrappers.map(wrapper => wrapper.encode())
    }
  }

  public static decode(state: ParallelResourceOperationTaskState): ParallelResourceOperationTask | null {
    const apiWrappers: ApiWrapperType[] = []
    for (const wrapperState of state.apiWrapperStates) {
      const wrapper = decodeCreepApiWrapperFromState(wrapperState)
      if (wrapper == null) {
        return null
      }
      if (!isResourceOperationApiWrapper(wrapper) || !isTargetingApiWrapper(wrapper)) {
        PrimitiveLogger.programError(`${this.constructor.name} API wrapper ${wrapperState.t} is not either TargetingApiWrapper or ResourceOperationApiWrapper`)
        return null
      }
      apiWrappers.push(wrapper)
    }
    return new ParallelResourceOperationTask(state.s, apiWrappers)
  }

  public static create(resourceTypes: ResourceConstant[], apiWrapperMaker: (resourceType: ResourceConstant) => ApiWrapperType): ParallelResourceOperationTask {
    const apiWrappers = resourceTypes.map(resourceType => apiWrapperMaker(resourceType))
    return new ParallelResourceOperationTask(Game.time, apiWrappers)
  }

  public taskTargets(creep: V6Creep): TaskTarget[] {
    return this.apiWrappers.map(wrapper => wrapper.taskTarget(creep))
  }

  public run(creep: V6Creep): CreepTaskProgress {
    let moveToPosition = null as RoomPosition | null
    let inProgress = false as boolean

    for (const apiWrapper of this.apiWrappers) {
      const result = apiWrapper.run(creep)
      switch (result.apiWrapperProgressType) {
      case "finished":
        break
      case "failed":
        return CreepTaskProgress.Finished([result.problem])
      case "in progress":
        inProgress = true
        if (result.notInRange === true) {
          moveToPosition = apiWrapper.target.pos
        }
        break
      }
    }
    if (moveToPosition != null) {
      const moveResult = MoveToPositionTask.create(moveToPosition, 0).run(creep)
      return CreepTaskProgress.InProgress(moveResult.problems)
    }
    return inProgress === true ? CreepTaskProgress.InProgress([]) : CreepTaskProgress.Finished([])
  }
}
