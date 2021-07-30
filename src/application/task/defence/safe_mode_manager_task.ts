import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { profileLink, roomLink } from "utility/log"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { Timestamp } from "utility/timestamp"
import { calculateDefenceTaskPerformance, DefenceTaskPerformance, DefenceTaskPerformanceState, emptyDefenceTaskPerformanceState } from "application/task_profit/defence_task_performance"
import { Invader } from "game/invader"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

type SafeModeManagerTaskOutput = void
type SafeModeManagerTaskProblemTypes = UnexpectedProblem
type SafeModeManagerTaskOutputs = TaskOutputs<SafeModeManagerTaskOutput, SafeModeManagerTaskProblemTypes>

export interface SafeModeManagerTaskState extends TaskState {
  /** task type identifier */
  readonly t: "SafeModeManagerTask"

  /** performance */
  readonly pf: DefenceTaskPerformanceState


}

export class SafeModeManagerTask extends Task<SafeModeManagerTaskOutput, SafeModeManagerTaskProblemTypes, DefenceTaskPerformance, DefenceTaskPerformanceState> {
  public readonly taskType = "SafeModeManagerTask"
  public readonly identifier: TaskIdentifier

  private readonly codename: string

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    public readonly performanceState: DefenceTaskPerformanceState,
  ) {
    super(startTime, sessionStartTime, roomName, performanceState)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.startTime)
  }

  public encode(): SafeModeManagerTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      pf: this.performanceState,
    }
  }

  public static decode(state: SafeModeManagerTaskState): SafeModeManagerTask {
    return new SafeModeManagerTask(state.s, state.ss, state.r, state.pf)
  }

  public static create(roomName: RoomName): SafeModeManagerTask {
    return new SafeModeManagerTask(Game.time, Game.time, roomName, emptyDefenceTaskPerformanceState())
  }

  public run(roomResource: OwnedRoomResource): SafeModeManagerTaskOutputs {
    const taskOutputs: SafeModeManagerTaskOutputs = emptyTaskOutputs()

    const invaders: AnyCreep[] = []
    invaders.push(...roomResource.hostiles.creeps)
    invaders.push(...roomResource.hostiles.powerCreeps)
    if (invaders.length <= 0) {
      return taskOutputs
    }

    const events = roomResource.room.getEventLog()
    for (const event of events) {
      if (event.event !== EVENT_ATTACK) {
        continue
      }
      for (const invader of invaders) {
        if (invader.id !== event.data.targetId) {
          continue
        }
        if (invader.hits < invader.hitsMax) {
          continue
        }

        const result = roomResource.controller.activateSafeMode()
        switch (result) {
        case OK:
          taskOutputs.logs.push({
            taskIdentifier: this.identifier,
            logEventType: "event",
            message: `${roomLink(this.roomName)} activate safe mode (${invader}), attacker: ${profileLink(invader.owner.username)}`
          })
          return taskOutputs

        case ERR_BUSY:
        case ERR_NOT_ENOUGH_RESOURCES:
        case ERR_TIRED:
          taskOutputs.logs.push({
            taskIdentifier: this.identifier,
            logEventType: "event",
            message: `${roomLink(this.roomName)} activate safe mode failed ${result}, (${invader}), attacker: ${profileLink(invader.owner.username)}`
          })
          return taskOutputs

        case ERR_NOT_OWNER:
          PrimitiveLogger.programError(`${this.identifier} controller.activateSafeMode() returns ${result}, ${roomLink(this.roomName)}, attacker: ${profileLink(invader.owner.username)}`)
          return taskOutputs
        }
      }
    }

    return taskOutputs
  }

  // ---- Profit ---- //
  public estimate(roomResource: OwnedRoomResource): DefenceTaskPerformance {
    const resourceCost = new Map<ResourceConstant, number>()

    return {
      periodType: 0,
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0,
      numberOfCreeps: 0,
      resourceCost,
    }
  }

  public performance(period: Timestamp): DefenceTaskPerformance {
    return calculateDefenceTaskPerformance(period, 0, this.performanceState)
  }
}
