import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { RoomName } from "utility/room_name"
import { TaskRequestHandler, TaskRequestHandlerInputs } from "./task_request_handler"
import { Timestamp } from "utility/timestamp"
import { GameConstants } from "utility/constants"
import { Season3FindPowerBankTask, Season3FindPowerBankTaskState } from "../season3_power_harvester/season3_find_power_bank_task"
import { TaskPrioritizer, TaskPrioritizerPrioritizedTasks, TaskPrioritizerTaskEstimation } from "./task_prioritizer"
import { ObserveTaskPerformance, ObserveTaskPerformanceState } from "application/task_profit/observe_task_performance"
import { EconomyTaskPerformance, EconomyTaskPerformanceState } from "application/task_profit/economy_task_performance"
import type { TaskPerformance, TaskPerformanceState } from "application/task_profit"
import type { AnyTask } from "application/any_task"
import { CreepName } from "prototype/creep"
import { CreepTaskAssignTaskRequest } from "application/task_request"
import { RoomKeeperTaskProblemTypes } from "./task_request_handler/room_keeper_problem_solver"
import { AnyTaskProblem } from "application/any_problem"
import { roomLink } from "utility/log"
import { emptyRoomKeeperPerformanceState, RoomKeeperPerformance, RoomKeeperPerformanceState } from "application/task_profit/owned_room_performance"

const config = {
  powerHarvestingEnabled: true
}

type RoomKeeperTaskOutput = void
export type RoomKeeperTaskOutputs = TaskOutputs<RoomKeeperTaskOutput, RoomKeeperTaskProblemTypes>

export interface RoomKeeperTaskState extends TaskState {
  /** task type identifier */
  readonly t: "RoomKeeperTask"

  /** performance */
  readonly pf: RoomKeeperPerformanceState

  /** child task states */
  c: {
    /** find power bank task state */
    pf: Season3FindPowerBankTaskState | null
  }
}

/**
 * - [ ] タスクの開始
 * - [ ] タスクの終了条件（親が決める
 */
export class RoomKeeperTask extends Task<RoomKeeperTaskOutput, RoomKeeperTaskProblemTypes, RoomKeeperPerformance, RoomKeeperPerformanceState> {
  public readonly taskType = "RoomKeeperTask"
  public readonly identifier: TaskIdentifier

  private readonly taskRequestHandler: TaskRequestHandler
  private readonly taskPrioritizer = new TaskPrioritizer()

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    public readonly performanceState: RoomKeeperPerformanceState,
    private readonly children: {
      findPowerBank: Season3FindPowerBankTask | null,
    },
  ) {
    super(startTime, sessionStartTime, roomName, performanceState)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.taskRequestHandler = new TaskRequestHandler(this.roomName)
  }

  public encode(): RoomKeeperTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      pf: this.performanceState,
      c: {
        pf: this.children.findPowerBank?.encode() ?? null,
      },
    }
  }

  public static decode(state: RoomKeeperTaskState): RoomKeeperTask {
    const findPowerBank = ((): Season3FindPowerBankTask | null => {
      if (state.c.pf == null) {
        return null
      }
      return Season3FindPowerBankTask.decode(state.c.pf)
    })()
    const children = {
      findPowerBank,
    }
    return new RoomKeeperTask(state.s, state.ss, state.r, state.pf, children)
  }

  public static create(roomName: RoomName): RoomKeeperTask {
    const children = {
      findPowerBank: null,
    }
    return new RoomKeeperTask(Game.time, Game.time, roomName, emptyRoomKeeperPerformanceState(), children)
  }

  public run(roomResource: OwnedRoomResource): RoomKeeperTaskOutputs {
    const requestHandlerInputs: TaskRequestHandlerInputs = {
      creepTaskAssignRequests: new Map<CreepName, CreepTaskAssignTaskRequest>(),
      spawnRequests: [],
      towerRequests: [],
      problems: [],
      logs: [],
    }
    const taskPriority = this.prioritizeTasks(roomResource)

    this.runPowerBankTasks(roomResource, requestHandlerInputs, taskPriority)

    const { logs, unresolvedProblems } = this.taskRequestHandler.execute(roomResource, requestHandlerInputs)

    const taskOutputs: RoomKeeperTaskOutputs = emptyTaskOutputs()
    taskOutputs.logs.push(...logs)
    taskOutputs.problems.push(...unresolvedProblems)
    return taskOutputs
  }

  // ---- Power Bank ---- //
  private runPowerBankTasks(roomResource: OwnedRoomResource, requestHandlerInputs: TaskRequestHandlerInputs, taskPriority: TaskPrioritizerPrioritizedTasks): void {
    if (this.children.findPowerBank == null) {
      if (config.powerHarvestingEnabled !== true) {
        return
      }
      if (roomResource.room.energyCapacityAvailable < 2300) {
        return
      }
      this.children.findPowerBank = Season3FindPowerBankTask.create(this.roomName)
      if (this.children.findPowerBank == null) {
        return
      }
    }

    const findPowerBankOutputs = this.children.findPowerBank.runSafely(roomResource)
    this.concatRequests(findPowerBankOutputs, this.children.findPowerBank.identifier, taskPriority.executableTaskIdentifiers, requestHandlerInputs)

    const powerBanks = findPowerBankOutputs.output?.powerBanks ?? []
    powerBanks.forEach(powerBankInfo => {
      requestHandlerInputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message: `Power bank found in ${roomLink(powerBankInfo.roomName)}`
      })
    })
  }

  // ---- Request Handling ---- //
  private concatRequests(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
    taskOutputs: TaskOutputs<any, AnyTaskProblem>,
    taskIdentifier: TaskIdentifier,
    executableTaskIdentifiers: TaskIdentifier[],
    requestHandlerInputs: TaskRequestHandlerInputs,
  ): void {
    if (executableTaskIdentifiers.includes(taskIdentifier) === true) {
      requestHandlerInputs.spawnRequests.push(...taskOutputs.spawnRequests)
    }
    taskOutputs.creepTaskAssignRequests.forEach((taskRequest, creepName) => {
      requestHandlerInputs.creepTaskAssignRequests.set(creepName, taskRequest)
    })
    requestHandlerInputs.problems.push(...taskOutputs.problems)
    requestHandlerInputs.towerRequests.push(...taskOutputs.towerRequests)
    requestHandlerInputs.logs.push(...taskOutputs.logs)
  }

  // ---- Prioritize ---- //
  private prioritizeTasks(roomResource: OwnedRoomResource): TaskPrioritizerPrioritizedTasks {
    const economyTasks: AnyTask<EconomyTaskPerformance, EconomyTaskPerformanceState>[] = []

    const observeTasks: AnyTask<ObserveTaskPerformance, ObserveTaskPerformanceState>[] = []
    if (this.children.findPowerBank != null) {
      observeTasks.push(this.children.findPowerBank)
    }

    const getEstimations = <Performance extends TaskPerformance, PerformanceState extends TaskPerformanceState>(tasks: AnyTask<Performance, PerformanceState>[]): TaskPrioritizerTaskEstimation<Performance>[] => {
      return tasks.map(task => ({
        taskIdentifier: task.identifier,
        estimate: task.estimate(roomResource),
      }))
    }

    return this.taskPrioritizer.prioritizeTasks(
      roomResource,
      getEstimations(economyTasks),
      getEstimations(observeTasks),
    )
  }

  // ---- Profit ---- //
  public estimate(): RoomKeeperPerformance {
    const resourceCost = new Map<ResourceConstant, number>()

    return {
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0, // TODO:
      numberOfCreeps: 0,  // TODO:
      resourceCost, // TODO:
    }
  }

  public performance(period: Timestamp): RoomKeeperPerformance {
    const timeSpent = Math.min(Game.time - this.startTime, period)
    const fromTimestamp = Game.time - timeSpent
    const state = this.performanceState

    let spawnTime = 0
    let numberOfCreeps = 0

    state.s.forEach(spawnInfo => {
      if (spawnInfo.t < fromTimestamp) {
        return
      }
      spawnTime += spawnInfo.st
      numberOfCreeps += 1
    })

    const resourceCost = new Map<ResourceConstant, number>()
    state.r.forEach(resourceInfo => {
      if (resourceInfo.t < fromTimestamp) {
        return
      }
      const stored = resourceCost.get(resourceInfo.r) ?? 0
      resourceCost.set(resourceInfo.r, stored + resourceInfo.a)
    })

    return {
      periodType: "continuous",
      timeSpent,
      spawnTime,
      numberOfCreeps,
      resourceCost,
    }
  }
}
