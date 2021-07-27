import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { calculateEconomyTaskPerformance, EconomyTaskPerformance, EconomyTaskPerformanceState, emptyEconomyTaskPerformanceState } from "application/task_profit/economy_task_performance"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { roomLink } from "utility/log"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { Timestamp } from "utility/timestamp"

type PrimitiveWorkerTaskOutput = void
type PrimitiveWorkerTaskProblemTypes = UnexpectedProblem
type PrimitiveWorkerTaskOutputs = TaskOutputs<PrimitiveWorkerTaskOutput, PrimitiveWorkerTaskProblemTypes>

export interface PrimitiveWorkerTaskState extends TaskState {
  /** task type identifier */
  readonly t: "PrimitiveWorkerTask"

  /** performance */
  readonly pf: EconomyTaskPerformanceState
}

export class PrimitiveWorkerTask extends Task<PrimitiveWorkerTaskOutput, PrimitiveWorkerTaskProblemTypes, EconomyTaskPerformance, EconomyTaskPerformanceState> {
  public readonly taskType = "PrimitiveWorkerTask"
  public readonly identifier: TaskIdentifier

  private readonly codename: string

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    public readonly performanceState: EconomyTaskPerformanceState,
  ) {
    super(startTime, sessionStartTime, roomName, performanceState)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.startTime)
  }

  public encode(): PrimitiveWorkerTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      pf: this.performanceState,
    }
  }

  public static decode(state: PrimitiveWorkerTaskState): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(state.s, state.ss, state.r, state.pf)
  }

  public static create(roomName: RoomName): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(Game.time, Game.time, roomName, emptyEconomyTaskPerformanceState())
  }

  public run(roomResource: OwnedRoomResource): PrimitiveWorkerTaskOutputs {
    const taskOutputs: PrimitiveWorkerTaskOutputs = emptyTaskOutputs()
    taskOutputs.logs.push({
      taskIdentifier: this.identifier,
      logEventType: "event",
      message: `${roomLink(roomResource.room.name)}`
    })
    return taskOutputs
  }

  // ---- Profit ---- //
  public estimate(roomResource: OwnedRoomResource): EconomyTaskPerformance {
    const resourceCost = new Map<ResourceConstant, number>()

    return {
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0,
      numberOfCreeps: 0,
      resourceCost,
    }
  }

  public performance(period: Timestamp): EconomyTaskPerformance {
    return calculateEconomyTaskPerformance(period, "one time", this.performanceState)
  }
}
