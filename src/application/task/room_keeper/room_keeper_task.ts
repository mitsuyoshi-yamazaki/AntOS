import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import type { RoomName } from "utility/room_name"
import { TaskRequestHandler, TaskRequestHandlerInputs } from "./task_request_handler"
import { GameConstants } from "utility/constants"
import { Season3FindPowerBankTask, Season3FindPowerBankTaskPowerBankInfo, Season3FindPowerBankTaskState } from "../season3_power_harvester/season3_find_power_bank_task"
import { TaskPrioritizer, TaskPrioritizerPrioritizedTasks, TaskPrioritizerTaskEstimation } from "./task_prioritizer"
import { ObserveTaskPerformance } from "application/task_profit/observe_task_performance"
import { EconomyTaskPerformance } from "application/task_profit/economy_task_performance"
import type { TaskPerformance } from "application/task_profit"
import type { AnyTask } from "application/any_task"
import { CreepName } from "prototype/creep"
import { CreepTaskAssignTaskRequest } from "application/task_request"
import { RoomKeeperTaskProblemTypes } from "./task_request_handler/room_keeper_problem_solver"
import { AnyTaskProblem } from "application/any_problem"
import { coloredText, roomLink } from "utility/log"
import { RoomKeeperPerformance } from "application/task_profit/owned_room_performance"
import { OperatingSystem } from "os/os"
import { Season701205PowerHarvesterSwampRunnerProcess } from "process/onetime/season_701205_power_harvester_swamp_runner_process"
import { OwnedRoomMineralHarvesterTask, OwnedRoomMineralHarvesterTaskState } from "../mineral_harvester/owned_room_mineral_harvester_task"
import { ResearchTask, ResearchTaskState } from "../research/research_task"
import { parseLabs } from "script/room_plan"
import { SafeModeManagerTask, SafeModeManagerTaskState } from "../defence/safe_mode_manager_task"
import { WallBuilderTask, WallBuilderTaskState } from "../wall/wall_builder_task"
import { ConsumeTaskPerformance } from "application/task_profit/consume_task_performance"
import { Environment } from "utility/environment"
import { findRoomRoute } from "utility/map"
import { ErrorMapper } from "error_mapper/ErrorMapper"

const config = {
  powerHarvestingEnabled: true
}

type RoomKeeperTaskOutput = void
export type RoomKeeperTaskOutputs = TaskOutputs<RoomKeeperTaskOutput, RoomKeeperTaskProblemTypes>

export interface RoomKeeperTaskState extends TaskState {
  /** task type identifier */
  readonly t: "RoomKeeperTask"

  /** child task states */
  c: {
    /** find power bank task state */
    pf: Season3FindPowerBankTaskState | null

    safeModeTaskState: SafeModeManagerTaskState
    mineralHarvesterTaskState: OwnedRoomMineralHarvesterTaskState | null
    researchTaskState: ResearchTaskState | null
    wallBuilderTaskState: WallBuilderTaskState | null
  }
}

export class RoomKeeperTask extends Task<RoomKeeperTaskOutput, RoomKeeperTaskProblemTypes, RoomKeeperPerformance> {
  public readonly taskType = "RoomKeeperTask"
  public readonly identifier: TaskIdentifier

  private readonly taskRequestHandler: TaskRequestHandler
  private readonly taskPrioritizer = new TaskPrioritizer()

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    private readonly children: {  // TODO: economyTasks: {[index: string]: EconomyTask} などの形式にしてprioritize忘れがないようにする
      safeMode: SafeModeManagerTask,
      findPowerBank: Season3FindPowerBankTask | null,
      mineralHarvester: OwnedRoomMineralHarvesterTask | null,
      research: ResearchTask | null,
      wallBuilder: WallBuilderTask | null,
    },
  ) {
    super(startTime, sessionStartTime, roomName)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.taskRequestHandler = new TaskRequestHandler(this.roomName)
  }

  public encode(): RoomKeeperTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      c: {
        pf: this.children.findPowerBank?.encode() ?? null,
        safeModeTaskState: this.children.safeMode.encode(),
        mineralHarvesterTaskState: this.children.mineralHarvester?.encode() ?? null,
        researchTaskState: this.children.research?.encode() ?? null,
        wallBuilderTaskState: this.children.wallBuilder?.encode() ?? null,
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
    const safeMode = ((): SafeModeManagerTask => {
      if (state.c.safeModeTaskState == null) {  // Migration
        return SafeModeManagerTask.create(state.r)
      }
      return SafeModeManagerTask.decode(state.c.safeModeTaskState)
    })()
    const mineralHarvester = ((): OwnedRoomMineralHarvesterTask | null => {
      if (state.c.mineralHarvesterTaskState == null) {
        return null
      }
      return OwnedRoomMineralHarvesterTask.decode(state.c.mineralHarvesterTaskState)
    })()
    const research = ((): ResearchTask | null => {
      if (state.c.researchTaskState == null) {
        return null
      }
      return ResearchTask.decode(state.c.researchTaskState)
    })()
    const wallBuilder = ((): WallBuilderTask | null => {
      if (state.c.wallBuilderTaskState == null) {
        return null
      }
      return WallBuilderTask.decode(state.c.wallBuilderTaskState)
    })()
    const children = {
      findPowerBank,
      safeMode,
      mineralHarvester,
      research,
      wallBuilder,
    }
    return new RoomKeeperTask(state.s, state.ss, state.r, children)
  }

  public static create(roomName: RoomName): RoomKeeperTask {
    const children = {
      findPowerBank: null,
      safeMode: SafeModeManagerTask.create(roomName),
      mineralHarvester: null,
      research: null,
      wallBuilder: null,
    }
    return new RoomKeeperTask(Game.time, Game.time, roomName, children)
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

    ErrorMapper.wrapLoop((): void => {
      this.runPowerBankTasks(roomResource, requestHandlerInputs, taskPriority)
    }, "runPowerBankTasks()")()
    ErrorMapper.wrapLoop((): void => {
      this.runMineralHarvestTask(roomResource, requestHandlerInputs, taskPriority)
    }, "runMineralHarvestTask()")()
    ErrorMapper.wrapLoop((): void => {
      this.runResearchTask(roomResource, requestHandlerInputs, taskPriority)
    }, "runResearchTask()")()
    ErrorMapper.wrapLoop((): void => {
      this.runWallBuilder(roomResource, requestHandlerInputs, taskPriority)
    }, "runWallBuilder()")()
    ErrorMapper.wrapLoop((): void => {
      if ((Game.time % 937) === 17) {
        this.createRampart(roomResource)
      }
    }, "createRampart()")()

    const safeModeOutput = this.children.safeMode.runSafely(roomResource)
    this.concatRequests(safeModeOutput, this.children.safeMode.identifier, taskPriority.executableTaskIdentifiers, requestHandlerInputs)

    const taskOutputs: RoomKeeperTaskOutputs = emptyTaskOutputs()
    taskOutputs.spawnRequests.push(...requestHandlerInputs.spawnRequests)

    const { logs, unresolvedProblems } = this.taskRequestHandler.execute(roomResource, requestHandlerInputs)
    taskOutputs.logs.push(...logs)
    taskOutputs.problems.push(...unresolvedProblems)

    this.checkResourceInsufficiency(roomResource)

    return taskOutputs
  }

  // ---- Wall ---- //
  private runWallBuilder(roomResource: OwnedRoomResource, requestHandlerInputs: TaskRequestHandlerInputs, taskPriority: TaskPrioritizerPrioritizedTasks): void {
    if (roomResource.controller.level <= 4) {
      const energyAmount = (roomResource.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      if (energyAmount < 70000) {
        return
      }

    }
    if (this.children.wallBuilder == null) {
      this.children.wallBuilder = WallBuilderTask.create(this.roomName)
    }
    const outputs = this.children.wallBuilder.runSafely(roomResource)
    this.concatRequests(outputs, this.children.wallBuilder.identifier, taskPriority.executableTaskIdentifiers, requestHandlerInputs)
  }

  private createRampart(roomResource: OwnedRoomResource): void {
    if (roomResource.activeStructures.storage == null) {
      return
    }
    const position = roomResource.activeStructures.storage.pos
    if (position.findInRange(FIND_STRUCTURES, 0, { filter: {structureType: STRUCTURE_RAMPART}}).length > 0) {
      return
    }
    roomResource.room.createConstructionSite(position, STRUCTURE_RAMPART)
  }

  // ---- Research ---- //
  private runResearchTask(roomResource: OwnedRoomResource, requestHandlerInputs: TaskRequestHandlerInputs, taskPriority: TaskPrioritizerPrioritizedTasks): void {
    if (roomResource.controller.level < GameConstants.structure.availability.lab) {
      this.children.research = null
      return
    }

    const researchCompounds = roomResource.roomInfo.config?.researchCompounds
    if (researchCompounds == null) {
      this.children.research = null
      return
    }

    if (roomResource.roomInfo.researchLab == null) {
      const result = parseLabs(roomResource.room)
      if (result.resultType === "failed") {
        requestHandlerInputs.logs.push({
          taskIdentifier: this.identifier,
          logEventType: "event",
          message: result.reason,
        })
        return
      }

      const placedLabs = result.value
      requestHandlerInputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message: `inputs: ${result.value.inputLab1.pos}, ${result.value.inputLab2.pos}, outputs: ${result.value.outputLabs.length} labs`,
      })
      roomResource.roomInfo.researchLab = {
        inputLab1: placedLabs.inputLab1.id,
        inputLab2: placedLabs.inputLab2.id,
        outputLabs: placedLabs.outputLabs.map(lab => lab.id),
      }
    }

    if (this.children.research == null) {
      this.children.research = ResearchTask.create(this.roomName)
      requestHandlerInputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message: `${coloredText("[Launched]", "info")} ResearchTask ${roomLink(this.roomName)}`
      })
    }
    const outputs = this.children.research.runSafely(roomResource)
    this.concatRequests(outputs, this.children.research.identifier, taskPriority.executableTaskIdentifiers, requestHandlerInputs)
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
    roomResource.roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] = "optional"
  }

  // ---- Power Bank ---- //
  private runPowerBankTasks(roomResource: OwnedRoomResource, requestHandlerInputs: TaskRequestHandlerInputs, taskPriority: TaskPrioritizerPrioritizedTasks): void {
    const removeFindPowerBankTask = () => {
      if(this.children.findPowerBank != null) {
        this.children.findPowerBank = null
      }
    }
    if (Environment.world !== "season 3") {
      removeFindPowerBankTask()
      return
    }
    if (roomResource.controller.level <= 5) {
      removeFindPowerBankTask()
      return
    }
    if (roomResource.roomInfo.config?.disablePowerHarvesting === true) {
      removeFindPowerBankTask()
      return
    }
    const energyAmount = (roomResource.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      + (roomResource.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
    if (energyAmount < 70000) {
      return
    }

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

    const powerBanks = (findPowerBankOutputs.output?.powerBanks ?? []).filter(powerBankInfo => {
      if (this.canHarvestPowerBank(powerBankInfo, roomResource) !== true) {
        return
      }
      const decay = powerBankInfo.decayedBy - Game.time
      const minimumDamage = roomResource.controller.level < 7 ? 450 : 570
      const powerBankHits = 2000000 // TODO: 実際の値を求める
      const estimatedTicksToRoom = findRoomRoute(this.roomName, powerBankInfo.roomName, powerBankInfo.waypoints).length * GameConstants.room.size
      const margin = 500
      const maxAttackerCount = 3
      const estimatedTicksToDestroy = margin + estimatedTicksToRoom + Math.ceil((powerBankHits / minimumDamage) / Math.min(powerBankInfo.nearbySquareCount, maxAttackerCount))
      if (decay < estimatedTicksToDestroy) {
        requestHandlerInputs.logs.push({
          taskIdentifier: this.identifier,
          logEventType: "event",
          message: `Power bank in ${roomLink(powerBankInfo.roomName)} estimated ticks to destroy: ${estimatedTicksToDestroy}, decay: ${Math.floor(decay / 100) * 100}`
        })
        return false
      }
      return true
    })
    const targetPowerBank = powerBanks.sort((lhs, rhs) => {
      return lhs.powerAmount - rhs.powerAmount
    })[0]

    if (targetPowerBank == null) {
      return
    }
    this.launchPowerBankHarvestProcess(targetPowerBank)
    requestHandlerInputs.logs.push({
      taskIdentifier: this.identifier,
      logEventType: "event",
      message: `Launched power bank harvester process ${roomLink(targetPowerBank.roomName)}, amount: ${targetPowerBank.powerAmount}, decay: ${targetPowerBank.decayedBy - Game.time}, nearby squares: ${targetPowerBank.nearbySquareCount}`
    })
  }

  private canHarvestPowerBank(powerBankInfo: Season3FindPowerBankTaskPowerBankInfo, roomResource: OwnedRoomResource): boolean {
    const spawnOperatingRooms: RoomName[] = ["W21S23"]
    let processCount = spawnOperatingRooms.includes(this.roomName) === true ? 2 : 1
    if (roomResource.roomInfo.config?.disableUnnecessaryTasks === true) {
      return false
    }
    for (const processInfo of OperatingSystem.os.listAllProcesses()) {
      if (!(processInfo.process instanceof Season701205PowerHarvesterSwampRunnerProcess)) {
        continue
      }
      if (processInfo.process.targetRoomName === powerBankInfo.roomName) {
        return false
      }
      if (processInfo.process.parentRoomName === this.roomName && processInfo.process.isPickupFinished !== true) {
        processCount -= 1
        if (processCount <= 0) {
          return false
        }
      }
    }
    return true
  }

  private launchPowerBankHarvestProcess(powerBankInfo: Season3FindPowerBankTaskPowerBankInfo): void {
    OperatingSystem.os.addProcess(processId => Season701205PowerHarvesterSwampRunnerProcess.create(processId, this.roomName, powerBankInfo.roomName, powerBankInfo.waypoints, powerBankInfo.nearbySquareCount))
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
    const economyTasks: AnyTask<EconomyTaskPerformance>[] = []
    if (this.children.mineralHarvester != null) {
      economyTasks.push(this.children.mineralHarvester)
    }
    if (this.children.research != null) {
      economyTasks.push(this.children.research)
    }

    const observeTasks: AnyTask<ObserveTaskPerformance>[] = []
    if (this.children.findPowerBank != null) {
      observeTasks.push(this.children.findPowerBank)
    }

    const consumeTasks: AnyTask<ConsumeTaskPerformance>[] = []
    if (this.children.wallBuilder != null) {
      consumeTasks.push(this.children.wallBuilder)
    }

    const getEstimations = <Performance extends TaskPerformance>(tasks: AnyTask<Performance>[]): TaskPrioritizerTaskEstimation<Performance>[] => {
      return tasks.map(task => ({
        taskIdentifier: task.identifier,
        estimate: task.estimate(roomResource),
      }))
    }

    return this.taskPrioritizer.prioritizeTasks(
      roomResource,
      getEstimations(economyTasks),
      getEstimations(observeTasks),
      getEstimations(consumeTasks),
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
}
