import type { RoomName } from "shared/utility/room_name_types"
import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { MoveToRoomTask, MoveToRoomTaskState } from "../meta_task/move_to_room_task"
import { MoveToTargetTask, MoveToTargetTaskApiWrapper, MoveToTargetTaskState } from "./move_to_target_task"
import { WithdrawApiWrapper, WithdrawApiWrapperTargetType } from "../api_wrapper/withdraw_api_wrapper"

type TargetTypeWithdraw = {
  case: "withdraw"
  targetId: Id<WithdrawApiWrapperTargetType>
}
type TargetType = TargetTypeWithdraw

type TaskStateMoveToRoom = {
  readonly case: "move to room"
  readonly taskState: MoveToRoomTaskState
  readonly target: TargetTypeWithdraw
}
type TaskStateMoveToTarget = {
  readonly case: "move to target"
  readonly taskState: MoveToTargetTaskState
}
type TaskState = TaskStateMoveToRoom | TaskStateMoveToTarget

type CurrentTaskMoveToRoom = {
  readonly case: "move to room"
  readonly task: MoveToRoomTask
  readonly target: TargetTypeWithdraw
}
type CurrentTaskMoveToTarget = {
  readonly case: "move to target"
  readonly task: MoveToTargetTask
}
type CurrentTask = CurrentTaskMoveToRoom | CurrentTaskMoveToTarget

export interface MoveToInvisibleTargetTaskState extends CreepTaskState {
  readonly taskState: TaskState
}

export class MoveToInvisibleTargetTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    private currentTask: CurrentTask
  ) {
    this.shortDescription = currentTask.task.shortDescription
  }

  public encode(): MoveToInvisibleTargetTaskState {
    return {
      s: this.startTime,
      t: "MoveToInvisibleTargetTask",
      taskState: ((): TaskState => {
        switch (this.currentTask.case) {
        case "move to room":
          return {
            case: "move to room",
            taskState: this.currentTask.task.encode(),
            target: this.currentTask.target,
          }
        case "move to target":
          return {
            case: "move to target",
            taskState: this.currentTask.task.encode(),
          }
        }
      })(),
    }
  }

  public static decode(state: MoveToInvisibleTargetTaskState): MoveToInvisibleTargetTask | null {
    const currentTask = ((): CurrentTask | null => {
      switch (state.taskState.case) {
      case "move to room":
        return {
          case: "move to room",
          task: MoveToRoomTask.decode(state.taskState.taskState),
          target: state.taskState.target,
        }
      case "move to target": {
        const task = MoveToTargetTask.decode(state.taskState.taskState)
        if (task == null) {
          return null
        }
        return {
          case: "move to target",
          task,
        }
      }
      }
    })()

    if (currentTask == null) {
      return null
    }

    return new MoveToInvisibleTargetTask(state.s, currentTask)
  }

  public static create(destinationRoomName: RoomName, waypoints: RoomName[], target: TargetType, options?: { ignoreSwamp?: boolean}): MoveToInvisibleTargetTask {
    const moveToRoomTask = MoveToRoomTask.create(destinationRoomName, waypoints, options?.ignoreSwamp)
    const task: CurrentTaskMoveToRoom = {
      case: "move to room",
      task: moveToRoomTask,
      target,
    }
    return new MoveToInvisibleTargetTask(Game.time, task)
  }

  public run(creep: Creep): TaskProgressType {
    if (this.currentTask.case === "move to room") {
      if (creep.room.name === this.currentTask.task.destinationRoomName) {
        const task = this.createMoveToTargetTask(this.currentTask.target)
        if (task == null) {
          return TaskProgressType.Finished
        }
        this.currentTask = {
          case: "move to target",
          task,
        }
      }
    }

    return this.currentTask.task.run(creep)
  }

  private createMoveToTargetTask(targetType: TargetType): MoveToTargetTask | null {
    const target = Game.getObjectById(targetType.targetId)
    if (target == null) {
      return null
    }
    const apiWrapper = ((): MoveToTargetTaskApiWrapper => {
      switch (targetType.case) {
      case "withdraw":
        return WithdrawApiWrapper.create(target)
      }
    })()
    return MoveToTargetTask.create(apiWrapper)
  }
}
