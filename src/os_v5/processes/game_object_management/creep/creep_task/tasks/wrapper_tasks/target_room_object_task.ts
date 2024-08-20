import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { CreepActions } from "os_v5/utility/game_object/creep_action"
import { RoomName } from "shared/utility/room_name_types"
import { AnyTask, Task, TaskResult, taskTypeEncodingMap, TaskTypeEncodingMap } from "../../types"
import { Sequential } from "../combined_tasks/sequential_task"
import { MoveTo } from "../move_tasks/move_to_task"
import { ClaimController } from "../primitive_tasks/claim_controller_task"


type ChildTaskArgumentClaimController = {
  readonly taskType: "ClaimController"
  readonly sign: string | null
}
type ChildTaskArguments = ChildTaskArgumentClaimController

type ChildTaskEncodedArguments = [TaskTypeEncodingMap["ClaimController"], string | null]

type TargetRoomObjectState = {
  readonly t: TaskTypeEncodingMap["TargetRoomObject"]
  readonly r: RoomName
  readonly c: ChildTaskEncodedArguments
}


export type TargetRoomObjectResult = string | number
export type TargetRoomObjectError = "not_in_the_room" | "no_target" | "unexpected_task_type" | string | number


export class TargetRoomObject extends Task<TargetRoomObjectState, TargetRoomObjectResult, TargetRoomObjectError> {
  public get actionType(): CreepActions | null {
    return null // TODO:
  }

  private constructor(
    public readonly targetRoomName: RoomName,
    public readonly childTaskArguments: ChildTaskArguments,
  ) {
    super()
  }

  public static decode(state: TargetRoomObjectState): TargetRoomObject | null {
    const childTaskArguments = ((): ChildTaskArguments | null => {
      switch (state.c[0]) {
      case "d":
        return {
          taskType: "ClaimController",
          sign: state.c[1],
        }

      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = state.c[0]
        return null
      }
      }
    })()

    if (childTaskArguments == null) {
      return null
    }

    return new TargetRoomObject(state.r, childTaskArguments)
  }

  public static create(roomName: RoomName, childTaskArguments: ChildTaskArguments): TargetRoomObject {
    return new TargetRoomObject(roomName, childTaskArguments)
  }

  public encode(): TargetRoomObjectState {
    const childTaskEncodedArguments = ((): ChildTaskEncodedArguments => {
      switch (this.childTaskArguments.taskType) {
      case "ClaimController":
        return [taskTypeEncodingMap.ClaimController, this.childTaskArguments.sign]
      }
    })()

    return {
      t: "e",
      r: this.targetRoomName,
      c: childTaskEncodedArguments,
    }
  }

  public run(creep: AnyV5Creep): TaskResult<TargetRoomObjectResult, TargetRoomObjectError> {
    if (creep.room.name !== this.targetRoomName) {
      return {
        case: "failed",
        taskType: "TargetRoomObject",
        error: "not_in_the_room",
      }
    }

    switch (this.childTaskArguments.taskType) {
    case "ClaimController": {
      const controller = creep.room.controller
      if (controller == null) {
        return {
          case: "failed",
          taskType: "TargetRoomObject",
          error: "no_target",
        }
      }
      return {
        case: "next_task",
        task: this.createClaimTask(controller, this.childTaskArguments),
      }
    }

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.childTaskArguments.taskType
      return {
        case: "failed",
        taskType: "TargetRoomObject",
        error: "unexpected_task_type",
      }
    }
    }
  }

  private createClaimTask(controller: StructureController, args: ChildTaskArgumentClaimController): AnyTask {
    const tasks: AnyTask[] = [
      MoveTo.create(controller.pos),
      ClaimController.create(controller.id, args.sign ?? undefined)
    ]
    return Sequential.create(tasks)
  }
}
