import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { EconomyTaskPerformance, EconomyTaskPerformanceState, emptyEconomyTaskPerformanceState } from "application/task_profit/economy_task_performance"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"

type TemplateTaskOutput = void
type TemplateTaskProblemTypes = UnexpectedProblem
type TemplateTaskOutputs = TaskOutputs<TemplateTaskOutput, TemplateTaskProblemTypes>

export interface TemplateTaskState extends TaskState {
  /** task type identifier */
  readonly t: "TemplateTask"

  /** performance */
  readonly pf: EconomyTaskPerformanceState
}

export class TemplateTask extends Task<TemplateTaskOutput, TemplateTaskProblemTypes, EconomyTaskPerformance, EconomyTaskPerformanceState> {
  public readonly taskType = "TemplateTask"
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

  public encode(): TemplateTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      pf: this.performanceState,
    }
  }

  public static decode(state: TemplateTaskState): TemplateTask {
    return new TemplateTask(state.s, state.ss, state.r, state.pf)
  }

  public static create(roomName: RoomName): TemplateTask {
    return new TemplateTask(Game.time, Game.time, roomName, emptyEconomyTaskPerformanceState())
  }

  public run(): TemplateTaskOutputs {
    const taskOutputs: TemplateTaskOutputs = emptyTaskOutputs()

    return taskOutputs
  }

  // ---- Profit ---- //
  public estimate(): EconomyTaskPerformance {
    const resourceCost = new Map<ResourceConstant, number>()
    const resourceProfit = new Map<ResourceConstant, number>()

    return {
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0,
      numberOfCreeps: 0,
      resourceCost,
      resourceProfit,
    }
  }

  public performance(): EconomyTaskPerformance {
    return this.estimate()
  }
}
