import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomName } from "prototype/room"
import { TaskProgressType } from "task/task"
import { roomLink } from "utility/log"
import { ClaimControllerApiWrapper } from "../api_wrapper/claim_controller_api_wrapper"
import { CreepTask, CreepTaskState } from "../creep_task"
import { MoveToRoomTask, MoveToRoomTaskState } from "../meta_task/move_to_room_task"
import { MoveToTargetTask } from "./move_to_target_task"

export interface MoveClaimControllerTaskState extends CreepTaskState {
  /** target room name */
  r: RoomName

  /** move to room task state */
  m: MoveToRoomTaskState
}

export class MoveClaimControllerTask implements CreepTask {
  public readonly shortDescription = "claim"

  private constructor(
    public readonly startTime: number,
    public readonly targetRoomName: RoomName,
    private readonly moveToRoomTask: MoveToRoomTask,
  ) {
  }

  public encode(): MoveClaimControllerTaskState {
    return {
      s: this.startTime,
      t: "MoveClaimControllerTask",
      r: this.targetRoomName,
      m: this.moveToRoomTask.encode(),
    }
  }

  public static decode(state: MoveClaimControllerTaskState): MoveClaimControllerTask {
    const moveToRoomTask = MoveToRoomTask.decode(state.m)
    return new MoveClaimControllerTask(state.s, state.r, moveToRoomTask)
  }

  public static create(targetRoomName: RoomName, waypoints: RoomName[]): MoveClaimControllerTask {
    const moveToRoomTask = MoveToRoomTask.create(targetRoomName, waypoints)
    return new MoveClaimControllerTask(Game.time, targetRoomName, moveToRoomTask)
  }

  public run(creep: Creep): TaskProgressType {
    if (creep.room.name !== this.targetRoomName) {
      this.moveToRoomTask.run(creep)
      return TaskProgressType.InProgress
    }

    if (creep.room.controller == null) {
      PrimitiveLogger.fatal(`${this.constructor.name} invalid room ${roomLink(this.targetRoomName)}, room does not have controller`)
      return TaskProgressType.Finished
    }

    const claimControllerApiWrapper = ClaimControllerApiWrapper.create(creep.room.controller)
    return MoveToTargetTask.create(claimControllerApiWrapper).run(creep)
  }
}
