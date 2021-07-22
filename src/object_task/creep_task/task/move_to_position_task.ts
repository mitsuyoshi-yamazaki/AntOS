import type { ObjectTaskTarget } from "object_task/object_task_target_cache"
import { V6Creep } from "prototype/creep"
import { MoveToApiWrapper, MoveToApiWrapperOptions, MoveToApiWrapperState } from "../api_wrapper/move_to_api_wrapper"
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
    m: MoveToApiWrapperState
  }
}

export class MoveToPositionTask implements CreepTask {
  public readonly shortDescription: string
  public readonly targets: ObjectTaskTarget[] = []

  private constructor(
    public readonly startTime: number,
    public readonly moveToApiWrapper: MoveToApiWrapper,
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

  public static decode(state: MoveToPositionTaskState): MoveToPositionTask | null {
    const moveToApiWrapper = MoveToApiWrapper.decode(state.a.m)
    return new MoveToPositionTask(state.s, moveToApiWrapper)
  }

  public static create(destination: RoomPosition, moveToOptions?: MoveToApiWrapperOptions): MoveToPositionTask {
    const moveToApiWrapper = MoveToApiWrapper.create(destination, moveToOptions)
    return new MoveToPositionTask(Game.time, moveToApiWrapper)
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
