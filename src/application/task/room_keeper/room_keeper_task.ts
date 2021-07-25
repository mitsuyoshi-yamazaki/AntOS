import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { RoomName } from "utility/room_name"
import { TaskRequestHandler, TaskRequestHandlerInputs } from "./task_request_handler"
import { Timestamp } from "utility/timestamp"
import { GameConstants } from "utility/constants"
import { Season3FindPowerBankTask, Season3FindPowerBankTaskPowerBankInfo, Season3FindPowerBankTaskState } from "../season3_power_harvester/season3_find_power_bank_task"
import { TaskPrioritizer, TaskPrioritizerPrioritizedTasks, TaskPrioritizerTaskEstimation } from "./task_prioritizer"
import { ObserveTaskPerformance, ObserveTaskPerformanceState } from "application/task_profit/observe_task_performance"
import { EconomyTaskPerformance, EconomyTaskPerformanceState } from "application/task_profit/economy_task_performance"
import type { TaskPerformance, TaskPerformanceState } from "application/task_profit"
import type { AnyTask } from "application/any_task"
import { CreepName } from "prototype/creep"
import { CreepTaskAssignTaskRequest } from "application/task_request"
import { RoomKeeperTaskProblemTypes } from "./task_request_handler/room_keeper_problem_solver"
import { AnyTaskProblem } from "application/any_problem"
import { coloredText, roomLink } from "utility/log"
import { emptyRoomKeeperPerformanceState, RoomKeeperPerformance, RoomKeeperPerformanceState } from "application/task_profit/owned_room_performance"
import { ResourceInsufficiencyPriority } from "room_resource/room_info"
import { RoomResources } from "room_resource/room_resources"
import { TaskLogRequest } from "application/task_logger"
import { OperatingSystem } from "os/os"
import { Season701205PowerHarvesterSwampRunnerProcess } from "process/onetime/season_701205_power_harvester_swamp_runner_process"
import { OwnedRoomMineralHarvesterTask, OwnedRoomMineralHarvesterTaskState } from "../mineral_harvester/owned_room_mineral_harvester_task"

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

    mineralHarvesterTaskState: OwnedRoomMineralHarvesterTaskState | null
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
      mineralHarvester: OwnedRoomMineralHarvesterTask | null,
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
        mineralHarvesterTaskState: this.children.mineralHarvester?.encode() ?? null,
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
    const mineralHarvester = ((): OwnedRoomMineralHarvesterTask | null => {
      if (state.c.mineralHarvesterTaskState == null) {
        return null
      }
      return OwnedRoomMineralHarvesterTask.decode(state.c.mineralHarvesterTaskState)
    })()
    const children = {
      findPowerBank,
      mineralHarvester,
    }
    return new RoomKeeperTask(state.s, state.ss, state.r, state.pf, children)
  }

  public static create(roomName: RoomName): RoomKeeperTask {
    const children = {
      findPowerBank: null,
      mineralHarvester: null,
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
    this.runMineralHarvestTask(roomResource, requestHandlerInputs, taskPriority)

    const { logs, unresolvedProblems } = this.taskRequestHandler.execute(roomResource, requestHandlerInputs)

    const taskOutputs: RoomKeeperTaskOutputs = emptyTaskOutputs()
    taskOutputs.logs.push(...logs)
    taskOutputs.problems.push(...unresolvedProblems)

    this.checkResourceInsufficiency(roomResource)
    const sendSurplusResourceLog = this.sendSurplusResource(roomResource)
    if (sendSurplusResourceLog != null) {
      taskOutputs.logs.push(sendSurplusResourceLog)
    }

    return taskOutputs
  }

  // ---- Mineral Harvest ---- //
  private runMineralHarvestTask(roomResource: OwnedRoomResource, requestHandlerInputs: TaskRequestHandlerInputs, taskPriority: TaskPrioritizerPrioritizedTasks): void {
    if (roomResource.controller.level < GameConstants.structure.availability.extractor) {
      return
    }
    if (this.children.mineralHarvester == null) {
      this.children.mineralHarvester = OwnedRoomMineralHarvesterTask.create(this.roomName)
      requestHandlerInputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message: `${coloredText("[Launched]", "info")} OwnedRoomMineralHarvesterTask ${roomLink(this.roomName)}`
      })
    }
    const outputs = this.children.mineralHarvester.runSafely(roomResource)
    this.concatRequests(outputs, this.children.mineralHarvester.identifier, taskPriority.executableTaskIdentifiers, requestHandlerInputs)
  }

  // ---- Check Resource Insufficiency ---- //
  private checkResourceInsufficiency(roomResource: OwnedRoomResource): void {
    if (roomResource.controller.level >= 8) {
      if (roomResource.roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] != null) {
        delete roomResource.roomInfo.resourceInsufficiencies[RESOURCE_ENERGY]
      }
      return
    }
    if (roomResource.activeStructures.terminal == null) {
      const keys = Object.keys(roomResource.roomInfo.resourceInsufficiencies) as (keyof typeof roomResource.roomInfo.resourceInsufficiencies)[]
      keys.forEach(key => {
        delete roomResource.roomInfo.resourceInsufficiencies[key]
      })
      return
    }
    const canReceiveEnergy = roomResource.activeStructures.terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 160000
    if (canReceiveEnergy === true) {
      roomResource.roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] = ResourceInsufficiencyPriority.Optional
    }
  }

  private sendSurplusResource(roomResource: OwnedRoomResource): TaskLogRequest | null {
    if ((Game.time % 1511) !== 73) {
      return null
    }
    const terminal = roomResource.activeStructures.terminal
    if (terminal == null) {
      return null
    }
    const energyAmount = terminal.store.getUsedCapacity(RESOURCE_ENERGY)
    if (energyAmount < 100000) {
      return null
    }
    const sendAmount = energyAmount / 2
    const energyInsufficientRoom = RoomResources.getResourceInsufficientRooms(RESOURCE_ENERGY).sort((lhs, rhs) => {
      if (lhs.priority === rhs.priority) {
        return Game.market.calcTransactionCost(sendAmount, this.roomName, lhs.roomName) - Game.market.calcTransactionCost(sendAmount, this.roomName, rhs.roomName)
      }
      return lhs.priority - rhs.priority
    })[0]

    if (energyInsufficientRoom == null) {
      return null
    }
    const result = terminal.send(RESOURCE_ENERGY, sendAmount, energyInsufficientRoom.roomName)
    const resultDescription: string = result === OK ? "" : `${coloredText("[Failed] ", "error")}`
    const energyDescription = `Sent ${sendAmount}energy`
    return {
      taskIdentifier: this.identifier,
      logEventType: "event",
      message: `${resultDescription}${coloredText(energyDescription, "info")} from ${roomLink(this.roomName)} to ${roomLink(energyInsufficientRoom.roomName)}`
    }
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
    let launched = false
    powerBanks.forEach(powerBankInfo => {
      requestHandlerInputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message: `Power bank found in ${roomLink(powerBankInfo.roomName)}`
      })

      if (launched === true) {
        return
      }
      const decay = powerBankInfo.decayedBy - Game.time
      if (powerBankInfo.powerAmount < 1500 || decay < 2000 || powerBankInfo.nearbySquareCount < 2) {
        return
      }
      if (this.canHarvestPowerBank(powerBankInfo) !== true) {
        return
      }
      launched = true
      this.launchPowerBankHarvestProcess(powerBankInfo)
      requestHandlerInputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message: `Launched power bank harvester process ${roomLink(powerBankInfo.roomName)}, amount: ${powerBankInfo.powerAmount}, decay: ${decay}, nearby squares: ${powerBankInfo.nearbySquareCount}`
      })
    })
  }

  private canHarvestPowerBank(powerBankInfo: Season3FindPowerBankTaskPowerBankInfo): boolean {
    for (const processInfo of OperatingSystem.os.listAllProcesses()) {
      if (!(processInfo.process instanceof Season701205PowerHarvesterSwampRunnerProcess)) {
        continue
      }
      if (processInfo.process.targetRoomName === powerBankInfo.roomName) {
        return false
      }
      if (processInfo.process.parentRoomName === this.roomName && processInfo.process.isPickupFinished !== true) {
        return false
      }
    }
    return true
  }

  private launchPowerBankHarvestProcess(powerBankInfo: Season3FindPowerBankTaskPowerBankInfo): void {
    const process = OperatingSystem.os.addProcess(processId => Season701205PowerHarvesterSwampRunnerProcess.create(processId, this.roomName, powerBankInfo.roomName, powerBankInfo.waypoints))
    const logger = OperatingSystem.os.getLoggerProcess()
    logger?.didReceiveMessage(`add id ${process.processId}`)
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
    if (this.children.mineralHarvester != null) {
      economyTasks.push(this.children.mineralHarvester)
    }

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
