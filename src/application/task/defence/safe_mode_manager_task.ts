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
import { DefenceTaskPerformance } from "application/task_profit/defence_task_performance"
import { Invader } from "game/invader"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

type SafeModeManagerTaskOutput = void
type SafeModeManagerTaskProblemTypes = UnexpectedProblem
type SafeModeManagerTaskOutputs = TaskOutputs<SafeModeManagerTaskOutput, SafeModeManagerTaskProblemTypes>

export interface SafeModeManagerTaskState extends TaskState {
  /** task type identifier */
  readonly t: "SafeModeManagerTask"
}

export class SafeModeManagerTask extends Task<SafeModeManagerTaskOutput, SafeModeManagerTaskProblemTypes, DefenceTaskPerformance> {
  public readonly taskType = "SafeModeManagerTask"
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

  public encode(): SafeModeManagerTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
    }
  }

  public static decode(state: SafeModeManagerTaskState): SafeModeManagerTask {
    return new SafeModeManagerTask(state.s, state.ss, state.r)
  }

  public static create(roomName: RoomName): SafeModeManagerTask {
    return new SafeModeManagerTask(Game.time, Game.time, roomName)
  }

  public run(roomResource: OwnedRoomResource): SafeModeManagerTaskOutputs {
    const taskOutputs: SafeModeManagerTaskOutputs = emptyTaskOutputs()

    const invaders: AnyCreep[] = []
    invaders.push(...roomResource.hostiles.creeps)
    invaders.push(...roomResource.hostiles.powerCreeps)
    if (invaders.length <= 0) {
      return taskOutputs
    }

    if (roomResource.activeStructures.towers.length > 0) {
      if (roomResource.activeStructures.towers.some(tower => (tower.store.getUsedCapacity(RESOURCE_ENERGY) < (tower.store.getCapacity(RESOURCE_ENERGY) * 0.14)))) {
        const result = roomResource.controller.activateSafeMode()
        switch (result) {
        case OK: {
          const message = `${roomLink(this.roomName)} activate safe mode (${invaders})`
          PrimitiveLogger.fatal(message)
          taskOutputs.logs.push({
            taskIdentifier: this.identifier,
            logEventType: "event",
            message,
          })
          return taskOutputs
        }

        case ERR_BUSY:
        case ERR_NOT_ENOUGH_RESOURCES:
        case ERR_TIRED:
          taskOutputs.logs.push({
            taskIdentifier: this.identifier,
            logEventType: "event",
            message: `${roomLink(this.roomName)} activate safe mode failed ${result}, (${invaders})`
          })
          return taskOutputs

        case ERR_NOT_OWNER:
          PrimitiveLogger.programError(`${this.identifier} controller.activateSafeMode() returns ${result}, ${roomLink(this.roomName)}`)
          return taskOutputs
        }
      }
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
        if (invader.owner.username === Invader.username) {
          const closestTower = invader.pos.findClosestByRange(roomResource.activeStructures.towers)
          if (closestTower != null && invader.pos.getRangeTo(closestTower.pos) > 15) {
            continue
          }
        }

        const result = roomResource.controller.activateSafeMode()
        switch (result) {
        case OK: {
          const message = `${roomLink(this.roomName)} activate safe mode (${invader}), attacker: ${profileLink(invader.owner.username)}, hits: ${invader.hits}, hitsMax: ${invader.hitsMax}`
          PrimitiveLogger.fatal(message)
          taskOutputs.logs.push({
            taskIdentifier: this.identifier,
            logEventType: "event",
            message,
          })
          return taskOutputs
        }

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
}
