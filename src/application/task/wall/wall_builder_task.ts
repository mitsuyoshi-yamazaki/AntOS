import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import { RoomName } from "shared/utility/room_name"
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
import { calculateWallPositions } from "script/wall_builder"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText, roomLink } from "utility/log"
import { TaskLogRequest } from "application/task_logger"
import { OwnedRoomInfo } from "room_resource/room_info"

const wallTypes: StructureConstant[] = [
  STRUCTURE_WALL,
  STRUCTURE_RAMPART,
]
const wallAvailableLevel = GameConstants.structure.availability.terminal

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

    if (roomResource.controller.level >= wallAvailableLevel) {
      const processTime = Game.time + this.startTime
      if ((processTime % 37) === 3) {
        const wallLog = this.checkWallPositions(roomResource)
        if (wallLog != null) {
          taskOutputs.logs.push(wallLog)
        }
      }

      if ((processTime % 4099) === 17) {
        const rebuildLog = this.rebuildDestroyedWalls(roomResource.roomInfo)
        if (rebuildLog != null) {
          taskOutputs.logs.push(rebuildLog)
        }
      }
    }

    const repairWallFilter = (): (wall: StructureWall | StructureRampart) => boolean => {
      const excludedIds = roomResource.roomInfoAccessor.config.getNoRepairWallIds()

      const maxHits = roomResource.activeStructures.terminal == null ? 2000000 : roomResource.roomInfoAccessor.config.wallMaxHits

      return wall => {
        if (wall.hits == null) { // Novice/respawn areaのConstructedWallはhitsがundefined
          return false
        }
        if (wall.hits >= wall.hitsMax) {
          return false
        }
        if (wall.hits > maxHits) {
          return false
        }
        if (excludedIds.includes(wall.id) === true) {
          return false
        }
        return true
      }
    }

    const hasWallToRepair = (): boolean => {
      return [
        ...roomResource.walls,
        ...roomResource.ramparts,
      ].some(repairWallFilter())
    }

    const getWallsToRepair = (): (StructureWall | StructureRampart)[] => {
      return [
        ...roomResource.walls,
        ...roomResource.ramparts,
      ].filter(repairWallFilter())
    }

    const creepInfo = roomResource.runningCreepInfo(this.identifier)
    if (creepInfo.length < 1 && roomResource.hostiles.creeps.length <= 0) {
      const energyAmount = (roomResource.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
        + (roomResource.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)

      if (energyAmount > 80000) {
        const hasWalls = hasWallToRepair() === true || roomResource.constructionSites.some(site => wallTypes.includes(site.structureType))

        if (hasWalls === true) {
          if ((Game.time % 3) === 1) {
            const vitalStructureTypes: StructureConstant[] = [
              STRUCTURE_SPAWN,
              STRUCTURE_STORAGE,
              STRUCTURE_TERMINAL,
              STRUCTURE_TOWER,
              STRUCTURE_FACTORY,
            ]
            for (const structure of roomResource.room.find(FIND_MY_STRUCTURES)) {
              if (vitalStructureTypes.includes(structure.structureType) !== true) {
                continue
              }
              roomResource.room.createConstructionSite(structure.pos, STRUCTURE_RAMPART)
            }
          }

          taskOutputs.spawnRequests.push(this.spawnRequest(roomResource.room))
        }
      }
    }

    const idleCreeps = roomResource.idleCreeps(this.identifier)
    if (idleCreeps.length > 0) {
      const walls = getWallsToRepair()
      walls.sort((lhs, rhs) => lhs.hits - rhs.hits)
      const repairWall = walls[0] ?? null

      idleCreeps.forEach(creepInfo => {
        creepInfo.problems.forEach(problem => { // TODO: 処理できるものは処理する
          if (taskOutputs.problems.some(stored => stored.identifier === problem.identifier) !== true) {
            taskOutputs.problems.push(new UnexpectedProblem(problem))
          }
        })

        const creep = creepInfo.creep
        const task = this.creepTask(creep, roomResource, repairWall)
        if (task != null) {
          taskOutputs.creepTaskAssignRequests.set(creep.name, {
            taskType: "normal",
            task,
          })
        }
      })
    }

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

  private creepTask(creep: Creep, roomResource: OwnedRoomResource, wallToRepair: (StructureWall | StructureRampart) | null): CreepTask | null {
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

    if (wallToRepair != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(wallToRepair))
    }

    const randomRampart = roomResource.ramparts[Math.floor(Math.random() * roomResource.ramparts.length)]
    if (randomRampart != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(randomRampart))
    }

    creep.say("no walls")
    return null
  }

  private checkWallPositions(roomResource: OwnedRoomResource): TaskLogRequest | null {
    if (roomResource.constructionSites.some(constructionSite => wallTypes.includes(constructionSite.structureType))) {
      return null
    }

    const roomPlan = roomResource.roomInfo.roomPlan
    if (roomPlan == null) {
      return null
    }
    if (roomPlan.wallPositions == null) {
      const wallPositions = calculateWallPositions(roomResource.room, false)
      if (typeof wallPositions === "string") {
        PrimitiveLogger.log(`${coloredText("[Error]", "error")} ${roomLink(roomResource.room.name)} wall position calculation failed: ${wallPositions}`)
        return null
      }
      PrimitiveLogger.log(`${coloredText("[Wall builder]", "info")} ${wallPositions.length} walls in ${roomLink(roomResource.room.name)}`)
      roomPlan.wallPositions = wallPositions
    }

    const position = roomPlan.wallPositions[0]
    if (position == null) {
      return null
    }
    const result = roomResource.room.createConstructionSite(position.x, position.y, position.wallType)
    switch (result) {
    case OK:
      roomPlan.wallPositions.shift()
      return null

    case ERR_FULL:
      return null

    case ERR_INVALID_TARGET: {
      try {
        const roomPosition = new RoomPosition(position.x, position.y, roomResource.room.name)
        const hasWall = ((): boolean => {
          if (roomPosition.findInRange(FIND_STRUCTURES, 0, { filter: { structureType: STRUCTURE_WALL } }).length > 0) {
            return true
          }
          if (roomPosition.findInRange(FIND_MY_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length > 0) {
            return true
          }
          return false
        })()
        if (hasWall === true) {
          roomPlan.wallPositions.shift()
          return null
        }
        if (roomPosition.findInRange(FIND_MY_CONSTRUCTION_SITES, 0).length > 0) {
          return null
        }
      } catch (e) {
        PrimitiveLogger.programError(`${this.identifier} cannot create RoomPosition ${e}`)
      }
      const message = `createConstructionSite() returns ${result} at ${position.x},${position.y} in ${roomLink(roomResource.room.name)}`
      PrimitiveLogger.programError(`${this.identifier} ${message}`)
      return {
        taskIdentifier: this.identifier,
        message,
        logEventType: "event",
      }
    }

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
    default: {
      const message = `createConstructionSite() returns ${result} at ${position.x},${position.y} in ${roomLink(roomResource.room.name)}`
      PrimitiveLogger.programError(`${this.identifier} ${message}`)
      return {
        taskIdentifier: this.identifier,
        message,
        logEventType: "event",
      }
    }
    }
  }

  private rebuildDestroyedWalls(roomInfo: OwnedRoomInfo): TaskLogRequest | null {
    if (roomInfo.roomPlan?.wallPositions == null) {
      return null
    }
    if (roomInfo.roomPlan.wallPositions.length > 0) { // 建設中
      return null
    }
    roomInfo.roomPlan.wallPositions = undefined
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
