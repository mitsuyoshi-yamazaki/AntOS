import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { Timestamp } from "utility/timestamp"
import { calculateConsumeTaskPerformance, ConsumeTaskPerformance, ConsumeTaskPerformanceState, emptyConsumeTaskPerformanceState } from "application/task_profit/consume_task_performance"
import { SpawnCreepTaskRequest, SpawnTaskRequestPriority } from "application/task_request"
import { createCreepBody } from "utility/creep_body"
import { CreepTask } from "object_task/creep_task/creep_task"
import { MoveToTargetTask } from "object_task/creep_task/task/move_to_target_task"
import { WithdrawApiWrapper } from "object_task/creep_task/api_wrapper/withdraw_api_wrapper"
import { BuildWallTask } from "object_task/creep_task/task/build_wall_task"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"

const wallTypes: StructureConstant[] = [
  STRUCTURE_WALL,
  STRUCTURE_RAMPART,
]

type WallBuilderTaskOutput = void
type WallBuilderTaskProblemTypes = UnexpectedProblem
type WallBuilderTaskOutputs = TaskOutputs<WallBuilderTaskOutput, WallBuilderTaskProblemTypes>

export interface WallBuilderTaskState extends TaskState {
  /** task type identifier */
  readonly t: "WallBuilderTask"

  /** performance */
  readonly pf: ConsumeTaskPerformanceState
}

export class WallBuilderTask extends Task<WallBuilderTaskOutput, WallBuilderTaskProblemTypes, ConsumeTaskPerformance, ConsumeTaskPerformanceState> {
  public readonly taskType = "WallBuilderTask"
  public readonly identifier: TaskIdentifier

  private readonly codename: string

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    public readonly performanceState: ConsumeTaskPerformanceState,
  ) {
    super(startTime, sessionStartTime, roomName, performanceState)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.startTime)
  }

  public encode(): WallBuilderTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      pf: this.performanceState,
    }
  }

  public static decode(state: WallBuilderTaskState): WallBuilderTask {
    return new WallBuilderTask(state.s, state.ss, state.r, state.pf)
  }

  public static create(roomName: RoomName): WallBuilderTask {
    return new WallBuilderTask(Game.time, Game.time, roomName, emptyConsumeTaskPerformanceState())
  }

  public run(roomResource: OwnedRoomResource): WallBuilderTaskOutputs {
    const taskOutputs: WallBuilderTaskOutputs = emptyTaskOutputs()
    const creepInfo = roomResource.runningCreepInfo(this.identifier)
    if (creepInfo.length < 1) {
      const energyAmount = (roomResource.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
        + (roomResource.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)

      if (energyAmount > 80000) {
        const hasWalls = roomResource.walls.length > 0 || roomResource.ramparts.length > 0 || roomResource.constructionSites.some(site => wallTypes.includes(site.structureType))

        if (hasWalls === true) {
          taskOutputs.spawnRequests.push(this.spawnRequest(roomResource.room))
        }
      }
    }

    roomResource.idleCreeps(this.identifier).flatMap(creepInfo => {
      creepInfo.problems.forEach(problem => { // TODO: 処理できるものは処理する
        if (taskOutputs.problems.some(stored => stored.identifier === problem.identifier) !== true) {
          taskOutputs.problems.push(new UnexpectedProblem(problem))
        }
      })

      const creep = creepInfo.creep
      const task = this.creepTask(creep, roomResource)
      if (task != null) {
        taskOutputs.creepTaskAssignRequests.set(creep.name, {
          taskType: "normal",
          task,
        })
      }
    })

    return taskOutputs
  }

  private spawnRequest(room: Room): SpawnCreepTaskRequest {
    return new SpawnCreepTaskRequest(
      SpawnTaskRequestPriority.Cancellable,
      this.codename,
      this.identifier,
      null,
      createCreepBody([], [WORK, CARRY, MOVE], room.energyCapacityAvailable, 8),
      null,
      0
    )
  }

  private creepTask(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      const energyStore = ((): StructureTerminal | StructureStorage | null => {
        const terminal = roomResource.activeStructures.terminal
        const storage = roomResource.activeStructures.storage
        if (terminal == null) {
          return storage
        }
        if (storage == null) {
          return terminal
        }
        return storage.store.getUsedCapacity(RESOURCE_ENERGY) > terminal.store.getUsedCapacity(RESOURCE_ENERGY) ? storage : terminal
      })()
      if (energyStore == null) {
        return null // TODO: Problem化
      }
      return MoveToTargetTask.create(WithdrawApiWrapper.create(energyStore, RESOURCE_ENERGY))
    }

    const constructionSite: ConstructionSite<STRUCTURE_WALL> | ConstructionSite<STRUCTURE_RAMPART> | null = roomResource.constructionSites
      .find(site => wallTypes.includes(site.structureType)) as ConstructionSite<STRUCTURE_WALL> | ConstructionSite<STRUCTURE_RAMPART> | null
    if (constructionSite != null) {
      return BuildWallTask.create(constructionSite)
    }

    const walls = [
      ...roomResource.walls,
      ...roomResource.ramparts,
    ]
    const wall = walls
      .filter(w => w.hits < w.hitsMax)
      .sort((lhs, rhs) => {
        return lhs.hits - rhs.hits
      })[0]
    if (wall != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(wall))
    }

    return null
  }

  // ---- Profit ---- //
  public estimate(roomResource: OwnedRoomResource): ConsumeTaskPerformance {
    const resourceCost = new Map<ResourceConstant, number>()

    return {
      periodType: 0,
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0,
      numberOfCreeps: 0,
      resourceCost,
    }
  }

  public performance(period: Timestamp): ConsumeTaskPerformance {
    return calculateConsumeTaskPerformance(period, 0, this.performanceState)
  }
}
