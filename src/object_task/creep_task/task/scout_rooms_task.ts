import type { TaskTarget } from "object_task/object_task_target_cache"
import { V6Creep } from "prototype/creep"
import { RoomName } from "utility/room_name"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { MoveToRoomTask, MoveToRoomTaskState } from "./move_to_room_task"

export interface ScoutRoomsTaskState extends CreepTaskState {
  /** type identifier */
  t: "ScoutRoomsTask"

  targetRoomNames: RoomName[]
  moveToRoomTaskState: MoveToRoomTaskState
}

/** It never finishes */
export class ScoutRoomsTask implements CreepTask {
  public readonly shortDescription = "scout"

  private constructor(
    public readonly startTime: number,
    public readonly targetRoomNames: RoomName[],
    private moveToRoomTask: MoveToRoomTask,
  ) {
  }

  public encode(): ScoutRoomsTaskState {
    return {
      t: "ScoutRoomsTask",
      s: this.startTime,
      targetRoomNames: this.targetRoomNames,
      moveToRoomTaskState: this.moveToRoomTask.encode(),
    }
  }

  public static decode(state: ScoutRoomsTaskState): ScoutRoomsTask {
    const moveToRoomTask = MoveToRoomTask.decode(state.moveToRoomTaskState)
    return new ScoutRoomsTask(state.s, state.targetRoomNames, moveToRoomTask)
  }

  public static create(destinationRoomName: RoomName, targetRoomNames: RoomName[]): ScoutRoomsTask {
    const moveToRoomTask = MoveToRoomTask.create(destinationRoomName, targetRoomNames)
    return new ScoutRoomsTask(Game.time, targetRoomNames, moveToRoomTask)
  }

  public taskTargets(): TaskTarget[] {
    return []
  }

  public run(creep: V6Creep): CreepTaskProgress {
    const result = this.moveToRoomTask.run(creep)
    switch (result.progress) {
    case "finished":
      this.renewMoveToRoomTask()
      return CreepTaskProgress.InProgress(result.problems)
    case "in progress":
      return CreepTaskProgress.InProgress(result.problems)
    }
  }

  private renewMoveToRoomTask(): void {
    const previousTarget = this.moveToRoomTask.destinationRoomName
    const nextTarget = ((): RoomName => {
      const index = this.targetRoomNames.indexOf(previousTarget)
      if (index < 0) {
        return this.targetRoomNames[0] ?? previousTarget
      }
      return this.targetRoomNames[(index + 1)] ?? this.targetRoomNames[0] ?? previousTarget
    })()
    this.moveToRoomTask = MoveToRoomTask.create(nextTarget, [])
  }
}
