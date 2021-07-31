import { TaskTarget } from "object_task/object_task_target_cache"
import { V6Creep } from "prototype/creep"
import { MoveToApiOptions } from "../api_wrapper/move_to_api_options"
import { MoveToApiWrapper, MoveToApiWrapperState } from "../api_wrapper/move_to_api_wrapper"
import { MoveToPositionApiWrapper, MoveToPositionApiWrapperState } from "../api_wrapper/move_to_position_api_wrapper"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface MoveToPositionTaskOptions {
  /** 到達できない場合にタスクを終了する */
  finishWhenBlocked: boolean
}

export interface MoveToPositionTaskState extends CreepTaskState {
  /** type identifier */
  t: "MoveToPositionTask"

  /** api wrapper states */
  a: {
    /** moveTo api wrapper state */
    m: MoveToApiWrapperState | MoveToPositionApiWrapperState
  }
}

export class MoveToPositionTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly moveToApiWrapper: MoveToApiWrapper | MoveToPositionApiWrapper,
  ) {
    this.shortDescription = this.moveToApiWrapper.shortDescription
  }

  public encode(): MoveToPositionTaskState {
    return {
      t: "MoveToPositionTask",
      s: this.startTime,
      a: {
        m: this.moveToApiWrapper.encode(),
      },
    }
  }

  public static decode(state: MoveToPositionTaskState): MoveToPositionTask {
    const moveToApiWrapper = ((): MoveToApiWrapper | MoveToPositionApiWrapper => {
      switch (state.a.m.t) {
      case "MoveToApiWrapper":
        return MoveToApiWrapper.decode(state.a.m)
      case "MoveToPositionApiWrapper":
        return MoveToPositionApiWrapper.decode(state.a.m)
      }
    })()
    return new MoveToPositionTask(state.s, moveToApiWrapper)
  }

  public static create(destination: RoomPosition, range: number, moveToOptions?: MoveToApiOptions): MoveToPositionTask {
    const moveToApiWrapper = ((): MoveToApiWrapper | MoveToPositionApiWrapper => {
      if (range <= 0) {
        return MoveToPositionApiWrapper.create(destination, moveToOptions)
      } else {
        return MoveToApiWrapper.create(destination, range, moveToOptions)
      }
    })()
    return new MoveToPositionTask(Game.time, moveToApiWrapper)
  }

  public taskTargets(): TaskTarget[] {
    if (!(this.moveToApiWrapper instanceof MoveToPositionApiWrapper)) {
      return []
    }
    return [this.moveToApiWrapper.taskTarget()]
  }

  public run(creep: V6Creep): CreepTaskProgress {
    const result = this.moveToApiWrapper.run(creep)
    switch (result.apiWrapperProgressType) {
    case "in progress":
      return CreepTaskProgress.InProgress([])

    case "finished":
      return CreepTaskProgress.Finished([])

    case "failed":
      return CreepTaskProgress.Finished([result.problem])
    }
  }
}
