import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "shared/utility/room_name"
import { GameConstants } from "utility/constants"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { roomLink } from "utility/log"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { InfrastructureTaskPerformance } from "application/task_profit/infrastructure_performance"

type PrimitiveWorkerTaskOutput = void
type PrimitiveWorkerTaskProblemTypes = UnexpectedProblem
type PrimitiveWorkerTaskOutputs = TaskOutputs<PrimitiveWorkerTaskOutput, PrimitiveWorkerTaskProblemTypes>

export interface PrimitiveWorkerTaskState extends TaskState {
  /** task type identifier */
  readonly t: "PrimitiveWorkerTask"
}

export class PrimitiveWorkerTask extends Task<PrimitiveWorkerTaskOutput, PrimitiveWorkerTaskProblemTypes, InfrastructureTaskPerformance> {
  public readonly taskType = "PrimitiveWorkerTask"
  public readonly identifier: TaskIdentifier

  private readonly codename: string

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
  ) {
    super(startTime, sessionStartTime, roomName)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.startTime)
  }

  public encode(): PrimitiveWorkerTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
    }
  }

  public static decode(state: PrimitiveWorkerTaskState): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(state.s, state.ss, state.r)
  }

  public static create(roomName: RoomName): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(Game.time, Game.time, roomName)
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
  public estimate(roomResource: OwnedRoomResource): InfrastructureTaskPerformance {
    const resourceCost = new Map<ResourceConstant, number>()

    return {
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0,
      numberOfCreeps: 0,
      resourceCost,
    }
  }
}
