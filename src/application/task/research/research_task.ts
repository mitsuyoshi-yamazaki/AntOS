import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { EconomyTaskPerformance } from "application/task_profit/economy_task_performance"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { OwnedRoomResource, ResearchLabs } from "room_resource/room_resource/owned_room_resource"
import { MissingActiveStructureProblem } from "application/problem/object/missing_active_structure_problem"
import { CreepName } from "prototype/creep"
import { CreepTask } from "object_task/creep_task/creep_task"
import { MoveToTargetTask } from "object_task/creep_task/task/move_to_target_task"
import { TransferApiWrapper } from "object_task/creep_task/api_wrapper/transfer_api_wrapper"
import { WithdrawApiWrapper } from "object_task/creep_task/api_wrapper/withdraw_api_wrapper"
import { SpawnCreepTaskRequest, SpawnTaskRequestPriority } from "application/task_request"
import { createCreepBody } from "utility/creep_body"
import { isMineralCompoundConstant, MineralCompoundIngredients } from "utility/resource"
import { coloredResourceType, roomLink } from "utility/log"
import { ParallelResourceOperationTask } from "object_task/creep_task/task/parallel_resource_operation_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

type ResearchTaskOutput = void
type ResearchTaskProblemTypes = MissingActiveStructureProblem | UnexpectedProblem
type ResearchTaskOutputs = TaskOutputs<ResearchTaskOutput, ResearchTaskProblemTypes>

export interface ResearchTaskState extends TaskState {
  /** task type identifier */
  readonly t: "ResearchTask"

  compound: MineralCompoundConstant | null
}

export class ResearchTask extends Task<ResearchTaskOutput, ResearchTaskProblemTypes, EconomyTaskPerformance> {
  public readonly taskType = "ResearchTask"
  public readonly identifier: TaskIdentifier

  private readonly codename: string

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    private compound: MineralCompoundConstant | null,
  ) {
    super(startTime, sessionStartTime, roomName)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.startTime)
  }

  public encode(): ResearchTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      compound: this.compound,
    }
  }

  public static decode(state: ResearchTaskState): ResearchTask {
    return new ResearchTask(state.s, state.ss, state.r, state.compound)
  }

  public static create(roomName: RoomName): ResearchTask {
    return new ResearchTask(Game.time, Game.time, roomName, null)
  }

  public run(roomResource: OwnedRoomResource): ResearchTaskOutputs {
    const taskOutputs: ResearchTaskOutputs = emptyTaskOutputs()

    // FixMe: 材料がなくなったら次のcompoundsに変更する
    const compoundsList = roomResource.roomInfo.config?.researchCompounds
    if (compoundsList == null) {
      return taskOutputs
    }
    const compound = Object.keys(compoundsList)[0]
    if (compound == null) {
      return taskOutputs
    }
    if (!isMineralCompoundConstant(compound)) {
      PrimitiveLogger.programError(`${this.identifier} ${compound} is not a mineral compound, ${roomLink(this.roomName)}`)
      delete (compoundsList as {[index: string]: number})[compound]
      return taskOutputs
    }
    const compoundAmount = compoundsList[compound]
    if (compoundAmount == null) {
      PrimitiveLogger.programError(`${this.identifier} no amount for ${compound}, ${roomLink(this.roomName)}`)
      return taskOutputs
    }
    this.compound = compound

    const labs = roomResource.activeStructures.researchLabs
    if (labs == null) {
      taskOutputs.problems.push(new MissingActiveStructureProblem(this.roomName, STRUCTURE_LAB))
      return taskOutputs
    }

    const terminal = roomResource.activeStructures.terminal
    if (terminal == null) {
      taskOutputs.problems.push(new MissingActiveStructureProblem(this.roomName, STRUCTURE_TERMINAL))
      return taskOutputs
    }
    const storedCompoundAmount = terminal.store.getUsedCapacity(compound) + (roomResource.activeStructures.storage?.store.getUsedCapacity(compound) ?? 0)
    if (storedCompoundAmount >= compoundAmount) {
      taskOutputs.logs.push({
        taskIdentifier: this.identifier,
        logEventType: "event",
        message: `${compoundAmount} ${coloredResourceType(compound)} created ${roomLink(this.roomName)}.`,
      })
      delete compoundsList[compound]
      return taskOutputs
    }

    this.runLabCharger(roomResource, labs, terminal, compound, taskOutputs).forEach(({ creepName, task }) => {
      taskOutputs.creepTaskAssignRequests.set(creepName, {
        taskType: "normal",
        task,
      })
    })

    const creepCount = roomResource.runningCreepInfo(this.identifier).length
    const ingredients = MineralCompoundIngredients[compound]
    const ingrendient1Available = (terminal.store.getUsedCapacity(ingredients.lhs) > 0) || labs.outputLabs.some(lab => (lab.store.getUsedCapacity(ingredients.lhs) > 0))
    const ingrendient2Available = (terminal.store.getUsedCapacity(ingredients.rhs) > 0) || labs.outputLabs.some(lab => (lab.store.getUsedCapacity(ingredients.rhs) > 0))
    const resourceAvailable = ingrendient1Available && ingrendient2Available
    if (resourceAvailable && creepCount < 1) {
      taskOutputs.spawnRequests.push(this.labChargerSpawnRequest(roomResource))
    }

    let runReactionError = null as string | null
    labs.outputLabs.forEach(lab => {
      const result = lab.runReaction(labs.inputLab1, labs.inputLab2)
      switch (result) {
      case OK:
      case ERR_TIRED:
      case ERR_FULL:
      case ERR_NOT_ENOUGH_RESOURCES:
        break
      case ERR_NOT_OWNER:
      case ERR_INVALID_TARGET:
      case ERR_NOT_IN_RANGE:
      case ERR_INVALID_ARGS:
      case ERR_RCL_NOT_ENOUGH:
        runReactionError = `Lab.runReaction() returns ${result} in ${roomLink(this.roomName)}`
      }
    })
    if (runReactionError != null) {
      taskOutputs.logs.push({ // 本来ここで解決すべきエラーなのでProblemは上げない
        taskIdentifier: this.identifier,
        logEventType: "found problem",
        message: runReactionError,
      })
    }

    return taskOutputs
  }

  // ---- Creep ---- //
  private runLabCharger(roomResource: OwnedRoomResource, labs: ResearchLabs, terminal: StructureTerminal, compound: MineralCompoundConstant, outputs: ResearchTaskOutputs): { creepName: CreepName, task: CreepTask }[] {
    const ingredients = MineralCompoundIngredients[compound]

    return roomResource.idleCreeps(this.identifier).flatMap(creepInfo => {
      creepInfo.problems.forEach(problem => { // TODO: 処理できるものは処理する
        if (outputs.problems.some(stored => stored.identifier === problem.identifier) !== true) {
          outputs.problems.push(new UnexpectedProblem(problem))
        }
      })

      const creep = creepInfo.creep
      if (creep.ticksToLive != null && creep.ticksToLive < 30 && creep.store.getUsedCapacity() <= 0) {
        return []
      }

      if (creep.store.getUsedCapacity(ingredients.lhs) > 0) {
        if ((labs.inputLab1.mineralType === ingredients.lhs || labs.inputLab1.mineralType == null) && labs.inputLab1.store.getFreeCapacity(ingredients.lhs) > 0) {
          return {
            creepName: creep.name,
            task: MoveToTargetTask.create(TransferApiWrapper.create(labs.inputLab1, ingredients.lhs)),
          }
        }
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(TransferApiWrapper.create(terminal, ingredients.lhs)),
        }
      }

      if (creep.store.getUsedCapacity(ingredients.rhs) > 0) {
        if ((labs.inputLab2.mineralType === ingredients.rhs || labs.inputLab2.mineralType == null) && labs.inputLab2.store.getFreeCapacity(ingredients.rhs) > 0) {
          return {
            creepName: creep.name,
            task: MoveToTargetTask.create(TransferApiWrapper.create(labs.inputLab2, ingredients.rhs)),
          }
        }
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(TransferApiWrapper.create(terminal, ingredients.rhs)),
        }
      }

      if (creep.store.getUsedCapacity(compound) > 0) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(TransferApiWrapper.create(terminal, compound)),
        }
      }

      if (creep.store.getUsedCapacity() > 0) {
        const resourceTypes = Object.keys(creep.store) as ResourceConstant[]
        return {
          creepName: creep.name,
          task: ParallelResourceOperationTask.create(resourceTypes, resourceType => TransferApiWrapper.create(terminal, resourceType)),
        }
      }

      if (labs.inputLab1.mineralType != null && labs.inputLab1.mineralType !== ingredients.lhs) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(WithdrawApiWrapper.create(labs.inputLab1, labs.inputLab1.mineralType)),
        }
      }
      if (labs.inputLab2.mineralType != null && labs.inputLab2.mineralType !== ingredients.rhs) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(WithdrawApiWrapper.create(labs.inputLab2, labs.inputLab2.mineralType)),
        }
      }
      const resourceIncompatibleOutputLab = labs.outputLabs.find(lab => {
        if (lab.mineralType != null && lab.mineralType !== compound) {
          return true
        }
        return false
      })
      if (resourceIncompatibleOutputLab != null && resourceIncompatibleOutputLab.mineralType != null) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(WithdrawApiWrapper.create(resourceIncompatibleOutputLab, resourceIncompatibleOutputLab.mineralType)),
        }
      }

      if ((labs.inputLab1.store.getUsedCapacity(ingredients.lhs) < (labs.inputLab1.store.getCapacity(ingredients.lhs) / 2)) && terminal.store.getUsedCapacity(ingredients.lhs) > 0) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(WithdrawApiWrapper.create(terminal, ingredients.lhs)),
        }
      }
      if ((labs.inputLab2.store.getUsedCapacity(ingredients.rhs) < (labs.inputLab2.store.getCapacity(ingredients.rhs) / 2)) && terminal.store.getUsedCapacity(ingredients.rhs) > 0) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(WithdrawApiWrapper.create(terminal, ingredients.rhs)),
        }
      }

      if (labs.outputLabs.length > 0) {
        const outputLab = labs.outputLabs.reduce((lhs, rhs) => {
          return lhs.store.getUsedCapacity(compound) > rhs.store.getUsedCapacity(compound) ? lhs : rhs
        })
        if (outputLab.store.getUsedCapacity(compound) > 0) {
          return {
            creepName: creep.name,
            task: MoveToTargetTask.create(WithdrawApiWrapper.create(outputLab, compound)),
          }
        }
      }
      return []
    })
  }

  // ---- Spawn ---- //
  private labChargerSpawnRequest(roomResource: OwnedRoomResource): SpawnCreepTaskRequest {
    return new SpawnCreepTaskRequest(
      SpawnTaskRequestPriority.Cancellable,
      this.codename,
      this.identifier,
      null,
      createCreepBody([], [MOVE, CARRY, CARRY], roomResource.room.energyCapacityAvailable, 2),
      null,
      0,
    )
  }

  // ---- Profit ---- //
  public estimate(roomResource: OwnedRoomResource): EconomyTaskPerformance {
    const resourceCost = new Map<ResourceConstant, number>()  // TODO:

    return {
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: 0,
      numberOfCreeps: 0,
      resourceCost,
    }
  }
}
