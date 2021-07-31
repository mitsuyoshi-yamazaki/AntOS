import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Stateful } from "os/infrastructure/state"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { RoomName } from "utility/room_name"
import type { Timestamp } from "utility/timestamp"
import { Problem } from "./problem"
import type { TaskType } from "./task_decoder"
import type { TaskIdentifier } from "./task_identifier"
import { TaskPerformance, TaskProfit } from "./task_profit"
import { emptyTaskOutputs, TaskOutputs } from "./task_requests"
import type { TaskState } from "./task_state"

export abstract class Task<OutputType, ProblemTypes extends Problem, Performance extends TaskPerformance>
implements Stateful, TaskProfit<Performance>
{
  protected constructor(
    public readonly startTime: Timestamp,

    /** pauseが明けた時間 */
    protected sessionStartTime: Timestamp,
    public readonly roomName: RoomName,
  ) {
    // if (this.isPaused() !== true) {
    //   this.paused = null
    // }
  }

  // ---- API ---- //
  abstract readonly taskType: TaskType
  abstract encode(): TaskState

  abstract estimate(roomResource: OwnedRoomResource): Performance

  /** 相似のタスクに引き継げるものは共通のTaskIdentifierを返す */
  abstract readonly identifier: TaskIdentifier
  abstract run(roomResource: OwnedRoomResource): TaskOutputs<OutputType, ProblemTypes>

  public runSafely(roomResource: OwnedRoomResource): TaskOutputs<OutputType, ProblemTypes> {
    const result = ErrorMapper.wrapLoop((): TaskOutputs<OutputType, ProblemTypes> => {
      return this.run(roomResource)
    }, `${this.constructor.name}.run()`)()

    if (result == null) {
      PrimitiveLogger.fatal(`${this.constructor.name}.run() threw an exception`)
      return emptyTaskOutputs()
    }
    return result
  }

  // // ---- Pause ---- //
  // public pause(isPaused: boolean): void {
  //   if (isPaused === true) {
  //     this.paused = 0
  //   } else {
  //     if (this.isPaused() === true) {
  //       this.sessionStartTime = Game.time
  //     }
  //     this.paused = null
  //   }
  // }

  // public pauseUntil(until: Timestamp): void {
  //   if (until < Game.time) {
  //     if (this.isPaused() === true) {
  //       this.sessionStartTime = Game.time
  //     }
  //     this.paused = null
  //     return
  //   }
  //   this.paused = until
  // }

  // public isPaused(): boolean {
  //   if (this.paused == null) {
  //     return false
  //   }
  //   if (this.paused === 0) {
  //     return true
  //   }
  //   return this.paused < Game.time
  // }

  // public getPaused(): number | null {
  //   return this.paused
  // }
}
