import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { randomDirection } from "utility/constants"

export interface RandomMoveTaskState extends CreepTaskState {
}

export class RandomMoveTask implements CreepTask {
  private constructor(
  ) {
  }

  public encode(): RandomMoveTaskState {
    return {
      t: "RandomMoveTask",
    }
  }

  public static decode(state: RandomMoveTaskState): RandomMoveTask | null {
    return new RandomMoveTask()
  }

  public static create(): RandomMoveTask {
    return new RandomMoveTask()
  }

  public run(creep: Creep): TaskProgressType {
    creep.move(randomDirection(0))
    return TaskProgressType.FinishedAndRan
  }
}
