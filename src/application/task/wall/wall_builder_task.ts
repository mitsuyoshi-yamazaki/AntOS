import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { ConsumeTaskPerformance } from "application/task_profit/consume_task_performance"
import { SpawnCreepTaskRequest, SpawnTaskRequestPriority } from "application/task_request"
import { CreepBody } from "utility/creep_body"
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
}

export class WallBuilderTask extends Task<WallBuilderTaskOutput, WallBuilderTaskProblemTypes, ConsumeTaskPerformance> {
  public readonly taskType = "WallBuilderTask"
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

  public encode(): WallBuilderTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
    }
  }

  public static decode(state: WallBuilderTaskState): WallBuilderTask {
    return new WallBuilderTask(state.s, state.ss, state.r)
  }

  public static create(roomName: RoomName): WallBuilderTask {
    return new WallBuilderTask(Game.time, Game.time, roomName)
  }

  public beforeTick(roomResource: OwnedRoomResource): void {

  }

  /**
   * - Builderサイズ or hits上限により使用Energy量が変化する
   */
  public run(roomResource: OwnedRoomResource): WallBuilderTaskOutputs {
    const taskOutputs: WallBuilderTaskOutputs = emptyTaskOutputs()
    const creepInfo = roomResource.runningCreepInfo(this.identifier)
    if (creepInfo.length < 1) {
      const energyAmount = (roomResource.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
        + (roomResource.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)

      if (energyAmount > 80000) {
        const maxHits = 2000000
        const walls: (StructureWall | StructureRampart)[] = [
          ...roomResource.walls,
          ...roomResource.ramparts,
        ].filter(wall => {
          if (wall.hits >= wall.hitsMax) {
            return false
          }
          if (wall.hits > maxHits) {
            return false
          }
          return true
        })
        const hasWalls = walls.length > 0 || roomResource.constructionSites.some(site => wallTypes.includes(site.structureType))

        if (hasWalls === true) {
          if ((Game.time % 3) === 1) {
            const defendStructureTypes: StructureConstant[] = [
              STRUCTURE_SPAWN,
              STRUCTURE_STORAGE,
              STRUCTURE_TERMINAL,
              STRUCTURE_TOWER,
            ]
            for (const structure of roomResource.room.find(FIND_MY_STRUCTURES)) {
              if (defendStructureTypes.includes(structure.structureType) !== true) {
                continue
              }
              roomResource.room.createConstructionSite(structure.pos, STRUCTURE_RAMPART)
            }
          }

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
      CreepBody.create([], [WORK, CARRY, MOVE], room.energyCapacityAvailable, 8),
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
  /**
   * - [ ] estimateからRoomResource引数を除く
   */
  public estimate(roomResource: OwnedRoomResource): ConsumeTaskPerformance {
    const body = CreepBody.create([], [WORK, CARRY, MOVE], roomResource.room.energyCapacityAvailable, 8)
    const creepCount = 1
    const creepCost = CreepBody.cost(body) * creepCount
    const spawnTime = CreepBody.spawnTime(body) * creepCount

    const carryCapacity = CreepBody.carryCapacity(body)
    const repairPower = CreepBody.actionEnergyCost(body, "repair")
    const ticksToConsume = Math.ceil(carryCapacity / repairPower)
    const estimatedTimeToWithdrawEnergy = 20
    const energyCost = Math.ceil(GameConstants.creep.life.lifeTime / (ticksToConsume + estimatedTimeToWithdrawEnergy)) * carryCapacity

    const resourceCost = new Map<ResourceConstant, number>([
      [RESOURCE_ENERGY, creepCost + energyCost],
    ])

    return {
      consumeType: "build wall",
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime,
      numberOfCreeps: creepCount,
      resourceCost,
    }
  }
}
