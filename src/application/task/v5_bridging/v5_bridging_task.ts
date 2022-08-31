import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "shared/utility/room_name_types"
import { GameConstants } from "utility/constants"
import { EconomyTaskPerformance, EconomyTaskPerformanceState, emptyEconomyTaskPerformanceState } from "application/task_profit/economy_task_performance"
import { roomLink } from "utility/log"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { Task as V5Task } from "v5_task/task"
import { TaskState as V5TaskState } from "v5_task/task_state"
import { decodeTaskFrom as v5DecodeTaskFrom } from "v5_task/task_decoder"
import { World } from "world_info/world_info"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

type V5BridgingTaskOutput = void
type V5BridgingTaskProblemTypes = UnexpectedProblem
type V5BridgingTaskOutputs = TaskOutputs<V5BridgingTaskOutput, V5BridgingTaskProblemTypes>

export interface V5BridgingTaskState extends TaskState {
  /** task type identifier */
  readonly t: "V5BridgingTask"

  readonly v5TaskState: V5TaskState
}

/**
 * - [ ] タスクの開始
 * - [ ] タスクの終了条件（親が決める
 */
export class V5BridgingTask extends Task<V5BridgingTaskOutput, V5BridgingTaskProblemTypes, EconomyTaskPerformance> {
  public readonly taskType = "V5BridgingTask"
  public readonly identifier: TaskIdentifier


  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    private readonly v5Task: V5Task,
  ) {
    super(startTime, sessionStartTime, roomName)

    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): V5BridgingTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      v5TaskState: this.v5Task.encode(),
    }
  }

  public static decode(state: V5BridgingTaskState): V5BridgingTask | null {
    const v5Task = v5DecodeTaskFrom(state.v5TaskState)
    if (v5Task == null) {
      return null
    }
    return new V5BridgingTask(state.s, state.ss, state.r, v5Task)
  }

  public static create(roomName: RoomName, v5Task: V5Task): V5BridgingTask {
    return new V5BridgingTask(Game.time, Game.time, roomName, v5Task)
  }

  public run(): V5BridgingTaskOutputs {
    const taskOutputs: V5BridgingTaskOutputs = emptyTaskOutputs()

    const objects = World.rooms.getOwnedRoomObjects(this.roomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.roomName)} lost`)
      return taskOutputs
    }
    this.v5Task.run(objects)

    return taskOutputs
  }

  // ---- Profit ---- //
  public estimate(): EconomyTaskPerformance {
    const resourceCost = new Map<ResourceConstant, number>()
    const resourceProfit = new Map<ResourceConstant, number>()

    return {
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: GameConstants.creep.life.lifeTime * 0.9,
      numberOfCreeps: 20,
      resourceCost,
    }
  }
}
