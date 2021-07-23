import { ExitNotFoundProblem } from "application/problem/creep/exit_not_found_problem"
import { ExitToRoomNotFoundProblem } from "application/problem/creep/exit_to_room_not_found_problem"
import { SourceKeeper } from "game/source_keeper"
import type { ObjectTaskTarget } from "object_task/object_task_target_cache"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions, V6Creep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { GameConstants } from "utility/constants"
import { roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface ScoutRoomsTaskState extends CreepTaskState {
  /** type identifier */
  t: "ScoutRoomsTask"

  targetRoomNames: RoomName[]
  currentDestination: RoomName
}

/** It never finishes */
export class ScoutRoomsTask implements CreepTask {
  public readonly shortDescription = "scout"
  public readonly targets: ObjectTaskTarget[] = []

  private constructor(
    public readonly startTime: number,
    public readonly targetRoomNames: RoomName[],
    private currentDestination: RoomName,
  ) {
  }

  public encode(): ScoutRoomsTaskState {
    return {
      t: "ScoutRoomsTask",
      s: this.startTime,
      targetRoomNames: this.targetRoomNames,
      currentDestination: this.currentDestination,
    }
  }

  public static decode(state: ScoutRoomsTaskState): ScoutRoomsTask {
    return new ScoutRoomsTask(state.s, state.targetRoomNames, state.currentDestination)
  }

  public static create(targetRoomNames: RoomName[], currentDestination: RoomName): ScoutRoomsTask {
    return new ScoutRoomsTask(Game.time, targetRoomNames, currentDestination)
  }

  public run(creep: V6Creep): CreepTaskProgress {

  }
}
