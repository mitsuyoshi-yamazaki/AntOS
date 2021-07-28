import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import type { RoomName } from "utility/room_name"
import { GameConstants } from "utility/constants"
import { calculateEconomyTaskPerformance, EconomyTaskPerformance, EconomyTaskPerformanceState, emptyEconomyTaskPerformanceState } from "application/task_profit/economy_task_performance"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { generateCodename } from "utility/unique_id"
import { OwnedRoomResource, ResearchLabs } from "room_resource/room_resource/owned_room_resource"
import { Timestamp } from "utility/timestamp"
import { MissingActiveStructureProblem } from "application/problem/object/missing_active_structure_problem"
import { CreepName } from "prototype/creep"
import { CreepTask } from "object_task/creep_task/creep_task"
import { MoveToTargetTask } from "object_task/creep_task/task/move_to_target_task"
import { TransferApiWrapper } from "object_task/creep_task/api_wrapper/transfer_api_wrapper"
import { WithdrawApiWrapper } from "object_task/creep_task/api_wrapper/withdraw_api_wrapper"
import { SpawnCreepTaskRequest, SpawnTaskRequestPriority } from "application/task_request"
import { createCreepBody } from "utility/creep_body"

type ResearchTaskOutput = void
type ResearchTaskProblemTypes = MissingActiveStructureProblem | UnexpectedProblem
type ResearchTaskOutputs = TaskOutputs<ResearchTaskOutput, ResearchTaskProblemTypes>

export interface ResearchTaskState extends TaskState {
  /** task type identifier */
  readonly t: "ResearchTask"

  /** performance */
  readonly pf: EconomyTaskPerformanceState

  compound: MineralCompoundConstant | null
}

export class ResearchTask extends Task<ResearchTaskOutput, ResearchTaskProblemTypes, EconomyTaskPerformance, EconomyTaskPerformanceState> {
  public readonly taskType = "ResearchTask"
  public readonly identifier: TaskIdentifier

  private readonly codename: string

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    public readonly performanceState: EconomyTaskPerformanceState,
    private compound: MineralCompoundConstant | null,
  ) {
    super(startTime, sessionStartTime, roomName, performanceState)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.startTime)
  }

  public encode(): ResearchTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      pf: this.performanceState,
      compound: this.compound,
    }
  }

  public static decode(state: ResearchTaskState): ResearchTask {
    return new ResearchTask(state.s, state.ss, state.r, state.pf, state.compound)
  }

  public static create(roomName: RoomName): ResearchTask {
    return new ResearchTask(Game.time, Game.time, roomName, emptyEconomyTaskPerformanceState(), null)
  }

  public run(roomResource: OwnedRoomResource): ResearchTaskOutputs {
    const taskOutputs: ResearchTaskOutputs = emptyTaskOutputs()

    // FixMe: compoundsを選択する処理を実装する
    const compounds = RESOURCE_HYDROXIDE//roomResource.roomInfo.config?.researchCompounds
    // if (compounds == null) {
    //   return taskOutputs
    // }
    // this.compound = Object.keys(compounds)[0] as MineralCompoundConstant | null
    // if (this.compound == null) {
    //   return taskOutputs
    // }

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

    this.runLabCharger(roomResource, labs, terminal, compounds, taskOutputs).forEach(({ creepName, task }) => {
      taskOutputs.creepTaskAssignRequests.set(creepName, {
        taskType: "normal",
        task,
      })
    })

    const creepCount = roomResource.runningCreepInfo(this.identifier).length
    const ingredient1 = RESOURCE_HYDROGEN // TODO:
    const ingredient2 = RESOURCE_OXYGEN
    const resourceAvailable = terminal.store.getUsedCapacity(ingredient1) > 0 && terminal.store.getUsedCapacity(ingredient2) > 0
    if (resourceAvailable && creepCount < 1) {
      taskOutputs.spawnRequests.push(this.labChargerSpawnRequest(roomResource))
    }

    labs.outputLabs.forEach(lab => {
      lab.runReaction(labs.inputLab1, labs.inputLab2)
    })

    return taskOutputs
  }

  // ---- Creep ---- //
  private runLabCharger(roomResource: OwnedRoomResource, labs: ResearchLabs, terminal: StructureTerminal, compounds: MineralCompoundConstant, outputs: ResearchTaskOutputs): { creepName: CreepName, task: CreepTask }[] {
    const ingredient1 = RESOURCE_HYDROGEN // TODO:
    const ingredient2 = RESOURCE_OXYGEN

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

      if (creep.store.getUsedCapacity(ingredient1) > 0) { // TODO: 以前のMineralの回収
        if (labs.inputLab1.store.getFreeCapacity(ingredient1) > 0) {
          return {
            creepName: creep.name,
            task: MoveToTargetTask.create(TransferApiWrapper.create(labs.inputLab1, ingredient1)),
          }
        }
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(TransferApiWrapper.create(terminal, ingredient1)),
        }
      }

      if (creep.store.getUsedCapacity(ingredient2) > 0) { // TODO: 以前のMineralの回収
        if (labs.inputLab2.store.getFreeCapacity(ingredient2) > 0) {
          return {
            creepName: creep.name,
            task: MoveToTargetTask.create(TransferApiWrapper.create(labs.inputLab2, ingredient2)),
          }
        }
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(TransferApiWrapper.create(terminal, ingredient2)),
        }
      }

      if (creep.store.getUsedCapacity(compounds) > 0) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(TransferApiWrapper.create(terminal, compounds)),
        }
      }

      if (labs.inputLab1.store.getUsedCapacity(ingredient1) < (labs.inputLab1.store.getCapacity(ingredient1) / 2)) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(WithdrawApiWrapper.create(terminal, ingredient1)),
        }
      }
      if (labs.inputLab2.store.getUsedCapacity(ingredient2) < (labs.inputLab2.store.getCapacity(ingredient2) / 2)) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(WithdrawApiWrapper.create(terminal, ingredient2)),
        }
      }

      const outputLab = labs.outputLabs.find(lab => {
        if (lab.store.getFreeCapacity(compounds) < (lab.store.getCapacity(compounds) * 0.2)) {
          return true
        }
        return false
      })
      if (outputLab != null) {
        return {
          creepName: creep.name,
          task: MoveToTargetTask.create(WithdrawApiWrapper.create(outputLab, compounds)),
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
      createCreepBody([], [MOVE, CARRY, CARRY], roomResource.room.energyCapacityAvailable, 1),
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

  public performance(period: Timestamp): EconomyTaskPerformance {
    return calculateEconomyTaskPerformance(period, "continuous", this.performanceState)
  }
}

// const MineralCompoundIngredients: { [index in MineralCompoundConstant]: {lhs: ResourceConstant, rhs: ResourceConstant}} = {
//   OH: { lhs: RESOURCE_OXYGEN, rhs: RESOURCE_HYDROGEN },
//   ZK: {lhs: RESOURCE_ZYNTHIUM, rhs: RESOURCE_KEANIUM},
//   UL: { lhs: RESOURCE_UTRIUM, rhs: RESOURCE_LEMERGIUM},
//   G: { lhs: RESOURCE_ZYNTHIUM_KEANITE, rhs: RESOURCE_UTRIUM_LEMERGITE},
//   UH: { lhs: RESOURCE_UTRIUM, rhs: RESOURCE_HYDROGEN},
//   UO: { lhs: RESOURCE_UTRIUM, rhs: RESOURCE_OXYGEN},
//   KH: { lhs: RESOURCE_KEANIUM, rhs: RESOURCE_HYDROGEN},
//   KO: { lhs: RESOURCE_KEANIUM, rhs: RESOURCE_OXYGEN},
// }


// | RESOURCE_UTRIUM_OXIDE
// | RESOURCE_KEANIUM_HYDRIDE
// | RESOURCE_KEANIUM_OXIDE
// | RESOURCE_LEMERGIUM_HYDRIDE
// | RESOURCE_LEMERGIUM_OXIDE
// | RESOURCE_ZYNTHIUM_HYDRIDE
// | RESOURCE_ZYNTHIUM_OXIDE
// | RESOURCE_GHODIUM_HYDRIDE
// | RESOURCE_GHODIUM_OXIDE
// | RESOURCE_UTRIUM_ACID
// | RESOURCE_UTRIUM_ALKALIDE
// | RESOURCE_KEANIUM_ACID
// | RESOURCE_KEANIUM_ALKALIDE
// | RESOURCE_LEMERGIUM_ACID
// | RESOURCE_LEMERGIUM_ALKALIDE
// | RESOURCE_ZYNTHIUM_ACID
// | RESOURCE_ZYNTHIUM_ALKALIDE
// | RESOURCE_GHODIUM_ACID
// | RESOURCE_GHODIUM_ALKALIDE
// | RESOURCE_CATALYZED_UTRIUM_ACID
// | RESOURCE_CATALYZED_UTRIUM_ALKALIDE
// | RESOURCE_CATALYZED_KEANIUM_ACID
// | RESOURCE_CATALYZED_KEANIUM_ALKALIDE
// | RESOURCE_CATALYZED_LEMERGIUM_ACID
// | RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE
// | RESOURCE_CATALYZED_ZYNTHIUM_ACID
// | RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE
// | RESOURCE_CATALYZED_GHODIUM_ACID
// | RESOURCE_CATALYZED_GHODIUM_ALKALIDE;
