import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { EconomyTaskPerformance } from "application/task_profit/economy_task_performance"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { SpawnCreepTaskRequest, SpawnTaskRequestPriority } from "application/task_request"
import { createCreepBody } from "utility/creep_body"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { CreepName } from "prototype/creep"
import { CreepTask } from "object_task/creep_task/creep_task"
import { MoveToTargetTask } from "object_task/creep_task/task/move_to_target_task"
import { TransferApiWrapper } from "object_task/creep_task/api_wrapper/transfer_api_wrapper"
import { HarvestMineralApiWrapper } from "object_task/creep_task/api_wrapper/harvest_mineral_api_wrapper"
import { MissingTargetStructureProblem } from "application/problem/creep/missing_target_structure_problem"
import { SequentialTask } from "object_task/creep_task/combined_task/sequential_task"
import { WithdrawApiWrapper } from "object_task/creep_task/api_wrapper/withdraw_api_wrapper"

type OwnedRoomMineralHarvesterTaskOutput = void
type OwnedRoomMineralHarvesterTaskProblemTypes = UnexpectedProblem
type OwnedRoomMineralHarvesterTaskOutputs = TaskOutputs<OwnedRoomMineralHarvesterTaskOutput, OwnedRoomMineralHarvesterTaskProblemTypes>

export interface OwnedRoomMineralHarvesterTaskState extends TaskState {
  /** task type identifier */
  readonly t: "OwnedRoomMineralHarvesterTask"
}

export class OwnedRoomMineralHarvesterTask extends Task<OwnedRoomMineralHarvesterTaskOutput, OwnedRoomMineralHarvesterTaskProblemTypes, EconomyTaskPerformance> {
  public readonly taskType = "OwnedRoomMineralHarvesterTask"
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

  public encode(): OwnedRoomMineralHarvesterTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
    }
  }

  public static decode(state: OwnedRoomMineralHarvesterTaskState): OwnedRoomMineralHarvesterTask {
    return new OwnedRoomMineralHarvesterTask(state.s, state.ss, state.r)
  }

  public static create(roomName: RoomName): OwnedRoomMineralHarvesterTask {
    return new OwnedRoomMineralHarvesterTask(Game.time, Game.time, roomName)
  }

  public run(roomResource: OwnedRoomResource): OwnedRoomMineralHarvesterTaskOutputs {
    const taskOutputs: OwnedRoomMineralHarvesterTaskOutputs = emptyTaskOutputs()
    if (roomResource.roomInfo.config?.disableMineralHarvesting === true) {
      return taskOutputs
    }

    const mineral = roomResource.mineral
    if (mineral == null) {
      return taskOutputs
    }

    if (roomResource.activeStructures.extractor == null) {
      this.createExtractorConstructionSite(mineral, roomResource.room)
      return taskOutputs
    }

    const mineralType = mineral.mineralType
    const mineralAmount = (roomResource.activeStructures.terminal?.store.getUsedCapacity(mineralType) ?? 0)
      + (roomResource.activeStructures.storage?.store.getUsedCapacity(mineralType) ?? 0)
    const canHarvestMineral = roomResource.roomInfo.config?.disableUnnecessaryTasks !== true
      && mineral.mineralAmount > 0
      && roomResource.activeStructures.terminal != null
      && mineralAmount < 100000
      && roomResource.activeStructures.terminal.store.getFreeCapacity(mineralType) > 20000

    if (canHarvestMineral) {
      const creepCount = roomResource.runningCreepInfo(this.identifier).length
      if (creepCount < 1) {
        taskOutputs.spawnRequests.push(this.mineralHarvesterRequest(roomResource))
      }
    }

    this.runMineralHarvester(roomResource, mineral, taskOutputs).forEach(({ creepName, task }) => {
      taskOutputs.creepTaskAssignRequests.set(creepName, {
        taskType: "normal",
        task,
      })
    })

    return taskOutputs
  }

  // ---- Creep ---- //
  private runMineralHarvester(roomResource: OwnedRoomResource, mineral: Mineral, outputs: OwnedRoomMineralHarvesterTaskOutputs): { creepName: CreepName, task: CreepTask }[] {
    const mineralType = mineral.mineralType

    return roomResource.idleCreeps(this.identifier).flatMap(creepInfo => {
      creepInfo.problems.forEach(problem => { // TODO: 処理できるものは処理する
        if (problem instanceof MissingTargetStructureProblem) {
          return
        }
        if (outputs.problems.some(stored => stored.identifier === problem.identifier) !== true) {
          outputs.problems.push(new UnexpectedProblem(problem))
        }
      })

      const creep = creepInfo.creep
      if (creep.store.getFreeCapacity(mineralType) <= 0 || mineral.mineralAmount <= 0) {
        const transferTarget = this.transferTarget(roomResource)
        if (transferTarget == null) {
          return []
        }
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(TransferApiWrapper.create(transferTarget, mineralType)),
        }
      }

      const containers = mineral.pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_CONTAINER } }) as StructureContainer[]
      const container = containers.find(c => (c.store.getUsedCapacity(mineral.mineralType) > 0))
      if (container) {
        return {
          creepName: creep.name,
          task: SequentialTask.create([
            MoveToTargetTask.create(WithdrawApiWrapper.create(container, mineral.mineralType)),
            MoveToTargetTask.create(HarvestMineralApiWrapper.create(mineral)),
          ]),
        }
      }

      return {
        creepName: creep.name,
        task: MoveToTargetTask.create(HarvestMineralApiWrapper.create(mineral)),
      }
    })
  }

  private transferTarget(roomResource: OwnedRoomResource): StructureTerminal | StructureStorage | null {
    return roomResource.activeStructures.terminal ?? roomResource.activeStructures.storage ?? null
  }

  // ---- Spawn ---- //
  private mineralHarvesterRequest(roomResource: OwnedRoomResource): SpawnCreepTaskRequest {
    return new SpawnCreepTaskRequest(
      SpawnTaskRequestPriority.Cancellable,
      this.codename,
      this.identifier,
      null,
      this.mineralHarvesterBody(roomResource.room.energyCapacityAvailable),
      null,
      0,
    )
  }

  private mineralHarvesterBody(energyCapacity: number): BodyPartConstant[] {
    return createCreepBody([], [WORK, WORK, WORK, CARRY, MOVE, MOVE], energyCapacity, 8)
  }

  // ---- Extractor ---- //
  private createExtractorConstructionSite(mineral: Mineral, room: Room): void {
    const result = room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR)
    switch (result) {
    case OK:
    case ERR_RCL_NOT_ENOUGH:  // すでにConstruction Siteが存在する
      return

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
      if ((Game.time % 19) === 1) {
        PrimitiveLogger.programError(`${this.identifier} createConstructionSite() returns ${result} in ${roomLink(this.roomName)}`)
      }
    }
  }

  // ---- Profit ---- //
  public estimate(roomResource: OwnedRoomResource): EconomyTaskPerformance {  // TODO: 実装する
    const resourceCost = new Map<ResourceConstant, number>()

    return {
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0,
      numberOfCreeps: 0,
      resourceCost,
    }
  }
}
