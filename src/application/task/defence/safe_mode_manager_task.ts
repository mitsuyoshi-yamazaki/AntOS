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
import { DefenceTaskPerformance } from "application/task_profit/defence_task_performance"
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

    if (roomResource.controller.safeMode != null) {
      return taskOutputs
    }

    const invaders: AnyCreep[] = []
    invaders.push(...roomResource.hostiles.creeps)
    invaders.push(...roomResource.hostiles.powerCreeps)
    if (invaders.length <= 0) {
      return taskOutputs
    }

    if (roomResource.activeStructures.towers.length <= 0 && roomResource.roomInfo.config?.useSafemodeInBoostrap === true) {
      this.activateSafemode(roomResource.controller, `boostrapping ${roomLink(roomResource.room.name)}, invaders: ${invaders}`, taskOutputs)
      return taskOutputs
    }

    if (roomResource.activeStructures.towers.length > 0) {
      if (roomResource.activeStructures.towers.some(tower => (tower.store.getUsedCapacity(RESOURCE_ENERGY) < (tower.store.getCapacity(RESOURCE_ENERGY) * 0.14)))) {
        this.activateSafemode(roomResource.controller, `invaders: ${invaders}`, taskOutputs)
        return taskOutputs
      }
    }

    const energyAmount = roomResource.getResourceAmount(RESOURCE_ENERGY)
    if (roomResource.controller.level >= 6 && energyAmount < 10000) {
      if (roomResource.hostiles.powerCreeps.length > 0 || roomResource.hostiles.creeps.some(creep => creep.body.some(body => body.boost != null))) {
        this.activateSafemode(roomResource.controller, `lack of energy (${energyAmount})`, taskOutputs)
        return taskOutputs
      }
    }

    const vitalStructureTypes: StructureConstant[] = [
      STRUCTURE_SPAWN,
      STRUCTURE_POWER_SPAWN,
      STRUCTURE_STORAGE,
      STRUCTURE_TERMINAL,
      STRUCTURE_LAB,
      STRUCTURE_FACTORY,
      STRUCTURE_NUKER,
      STRUCTURE_TOWER,
      STRUCTURE_EXTENSION,
    ]
    const wallTypes: StructureConstant[] = [
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
    ]
    const wallMinimumHits = 100000

    const eventLogs = roomResource.room.getEventLog()
    const shouldActivateSafeMode = eventLogs.some(log => {
      switch (log.event) {
      case EVENT_ATTACK: {
        const target = Game.getObjectById(log.data.targetId)
        if (target == null) { // 破壊されている場合はnullが帰る
          return false
        }
        if ((target as {structureType?: StructureConstant}).structureType == null) {
          return false
        }
        const structureType = (target as { structureType: StructureConstant }).structureType
        if (vitalStructureTypes.includes(structureType) === true) {
          return true
        }
        if (wallTypes.includes(structureType) === true) {
          const hits = (target as { hits?: number }).hits
          if (hits == null) {
            PrimitiveLogger.programError(`${this.identifier} target ${target} with id ${log.data.targetId} doesn't have hits property`)
            return false
          }
          if (hits < wallMinimumHits) {
            return true
          }
        }
        return false
      }

      case EVENT_OBJECT_DESTROYED: {
        if (log.data.type === "creep") {
          return false
        }
        if (vitalStructureTypes.includes(log.data.type) === true) {
          return true
        }
        if (wallTypes.includes(log.data.type) === true) {
          return true
        }
        return false
      }

      default:
        return false
      }
    })

    if (shouldActivateSafeMode === true) {
      this.activateSafemode(roomResource.controller, "vital structure attacked", taskOutputs)
      return taskOutputs
    }

    return taskOutputs
  }

  private activateSafemode(controller: StructureController, reason: string, taskOutputs: SafeModeManagerTaskOutputs): void {
    // console.log(`activate safemode ${roomLink(controller.room.name)}`)
    // return

    const result = controller.activateSafeMode()
    switch (result) {
    case OK: {
      const message = `${roomLink(this.roomName)} activate safe mode (${reason})`
      PrimitiveLogger.fatal(message)
      taskOutputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message,
      })
      break
    }

    case ERR_BUSY:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_TIRED:
      taskOutputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message: `${roomLink(this.roomName)} activate safe mode failed ${result}, (${reason})`
      })
      break

    case ERR_NOT_OWNER:
      PrimitiveLogger.programError(`${this.identifier} controller.activateSafeMode() returns ${result}, ${roomLink(this.roomName)} (${reason})`)
      break
    }
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
