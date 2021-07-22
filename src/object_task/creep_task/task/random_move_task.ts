import type { ObjectTaskTarget } from "object_task/object_task_target_cache"
import { V6Creep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { randomDirection } from "utility/constants"
import { MoveApiWrapper } from "../api_wrapper/move_api_wrapper"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface RandomMoveTaskState extends CreepTaskState {
  /** type identifier */
  t: "RandomMoveTask"

  /** original position */
  p: RoomPositionState
}

export class RandomMoveTask implements CreepTask {
  public readonly shortDescription = "random w"
  public readonly targets: ObjectTaskTarget[] = []

  private constructor(
    public readonly startTime: number,
    public readonly originalPosition: RoomPosition,
  ) {
  }

  public encode(): RandomMoveTaskState {
    return {
      t: "RandomMoveTask",
      s: this.startTime,
      p: this.originalPosition.encode(),
    }
  }

  public static decode(state: RandomMoveTaskState): RandomMoveTask | null {
    const originalPosition = decodeRoomPosition(state.p)
    return new RandomMoveTask(state.s, originalPosition)
  }

  public static create(originalPosition: RoomPosition): RandomMoveTask {
    return new RandomMoveTask(Game.time, originalPosition)
  }

  public run(creep: V6Creep): CreepTaskProgress {
    const result = MoveApiWrapper.create(this.originalPosition, randomDirection(Game.time + this.startTime)).run(creep)
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
