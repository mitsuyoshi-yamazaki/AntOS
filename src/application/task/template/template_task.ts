import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { EconomyTaskPerformance } from "application/task_profit/economy_task_performance"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { roomLink } from "utility/log"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

type TemplateTaskOutput = void
type TemplateTaskProblemTypes = UnexpectedProblem
type TemplateTaskOutputs = TaskOutputs<TemplateTaskOutput, TemplateTaskProblemTypes>

export interface TemplateTaskState extends TaskState {
  /** task type identifier */
  readonly t: "TemplateTask"
}

export class TemplateTask extends Task<TemplateTaskOutput, TemplateTaskProblemTypes, EconomyTaskPerformance> {
  public readonly taskType = "TemplateTask"
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

  public encode(): TemplateTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
    }
  }

  public static decode(state: TemplateTaskState): TemplateTask {
    return new TemplateTask(state.s, state.ss, state.r)
  }

  public static create(roomName: RoomName): TemplateTask {
    return new TemplateTask(Game.time, Game.time, roomName)
  }

  public run(roomResource: OwnedRoomResource): TemplateTaskOutputs {
    const taskOutputs: TemplateTaskOutputs = emptyTaskOutputs()
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
      periodType: 0,
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0,
      numberOfCreeps: 0,
      resourceCost,
    }
  }
}
