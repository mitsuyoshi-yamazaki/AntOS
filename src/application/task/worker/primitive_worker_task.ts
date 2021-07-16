import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { CreepTaskAssignTaskRequest, SpawnCreepTaskRequest, SpawnTaskRequestPriority } from "application/task_request"
import { TaskRequests } from "application/task_requests"
import { TaskState } from "application/task_state"
import { CreepRole } from "prototype/creep_role"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { createCreepBody } from "utility/creep_body"
import { RoomName } from "utility/room_name"
import { createWorkerTaskIdentifier } from "./worker_task_definition"
import { CreepTask } from "object_task/creep_task/creep_task"
import { MoveToTargetTask } from "object_task/creep_task/task/move_to_target_task"
import { HarvestSourceApiWrapper } from "object_task/creep_task/api_wrapper/harvest_source_api_wrapper"
import { CreepName, defaultMoveToOptions } from "prototype/creep"
import { TransferApiWrapper } from "object_task/creep_task/api_wrapper/transfer_api_wrapper"
import { generateCodename } from "utility/unique_id"
import { Problem } from "application/problem"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { UpgradeControllerApiWrapper } from "object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { CreepDamagedProblem } from "application/problem/creep/creep_damaged_problem"
import { HarvestingRoomLostProblem } from "application/problem/creep/harvesting_room_lost_problem"
import { PathNotFoundProblem } from "application/problem/creep/path_not_found_problem"
import { TalkTask } from "object_task/creep_task/combined_task/talk_task"
import { RandomMoveTask } from "object_task/creep_task/task/random_move_task"

const creepCountForSource = 6

export interface PrimitiveWorkerTaskState extends TaskState {
  /** task type identifier */
  t: "PrimitiveWorkerTask"
}

export class PrimitiveWorkerTask extends Task {
  public readonly taskType = "PrimitiveWorkerTask"
  public readonly identifier: TaskIdentifier
  public get children(): Task[] {
    return []
  }

  private readonly codename: string

  protected constructor(
    public readonly startTime: number,
    public readonly roomName: RoomName,
    protected paused: number | null,
  ) {
    super(startTime, roomName, paused)

    this.identifier = createWorkerTaskIdentifier(this.roomName)
    this.codename = generateCodename(this.identifier, this.startTime)
  }

  public encode(): PrimitiveWorkerTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      r: this.roomName,
      p: this.paused,
    }
  }

  public static decode(state: PrimitiveWorkerTaskState): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(state.s, state.r, state.p)
  }

  public static create(roomName: RoomName): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(Game.time, roomName, null)
  }

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskRequests): TaskRequests {
    const creepCount = roomResource.countCreeps(this.identifier)
    const minimumCreepCount = creepCountForSource * roomResource.sources.length

    if (creepCount < minimumCreepCount) {
      requestsFromChildren.spawnRequests.push(new SpawnCreepTaskRequest(
        this.identifier,
        SpawnTaskRequestPriority.Medium,
        this.createBody(roomResource.room.energyCapacityAvailable),
        [CreepRole.Worker, CreepRole.Mover],
        this.codename,
      ))
    }

    const idleCreeps = roomResource.idleCreeps(this.identifier)
    idleCreeps.forEach(creepInfo => {
      // const problemSolverTask = this.problemSolverTask(creepInfo.creep, creepInfo.problems)
      // if () {

      // }

      // // problem identifierをキーにしてMapに格納する

      // const newTask = this.newTaskFor(creepInfo.creep, roomResource)

      // const creepName = creepInfo.creep.name
      // this.addCreepTaskRequest(creepName, newTask, requestsFromChildren)
    })

    return requestsFromChildren
  }

  private createBody(energyCapacity: number): BodyPartConstant[] {
    return createCreepBody([], [WORK, CARRY, MOVE, MOVE], energyCapacity, 3)
  }

  private problemSolverTask(creep: Creep, creepProblems: Problem[]): CreepTask | null {
    for (const creepProblem of creepProblems) {
      if (creepProblem instanceof PathNotFoundProblem) {
        return TalkTask.create(RandomMoveTask.create(creep.pos), ["no path"])
      }
    }
    return null
  }

  private newTaskFor(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {

    // creepProblems.forEach(problem => {
    //   if (problem instanceof CreepDamagedProblem) {

    //   } else if (problem instanceof HarvestingRoomLostProblem) {

    //   } else if (problem instanceof PathNotFoundProblem) {

    //   } else {

    //   }
    // })

    // const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    // if (noEnergy) {
    //   const source = roomResource.getSourceToAssign(creep.pos)
    //   if (source == null) {
    //     return null
    //   }
    //   return MoveToTargetTask.create(HarvestSourceApiWrapper.create(source), defaultMoveToOptions)
    // }

    // const structureToCharge = roomResource.getStructureToCharge(creep.pos)
    // if (structureToCharge != null) {
    //   return MoveToTargetTask.create(TransferApiWrapper.create(structureToCharge, RESOURCE_ENERGY), defaultMoveToOptions)
    // }

    // const damagedStructure = roomResource.getRepairStructure()
    // if (damagedStructure != null) {
    //   return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure), defaultMoveToOptions)
    // }
    // const constructionSite = roomResource.getConstructionSite()
    // if (constructionSite != null) {
    //   return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite), defaultMoveToOptions)
    // }

    // return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(roomResource.controller), defaultMoveToOptions)
    return null
  }

  private addCreepTaskRequest(creepName: CreepName, task: CreepTask, requests: TaskRequests): void {
    const taskRequest: CreepTaskAssignTaskRequest = {
      taskType: "normal",
      task: task,
    }

    if (requests.creepTaskAssignRequests.has(creepName) === true) {
      PrimitiveLogger.programError(`${this.identifier}`)
    }
    requests.creepTaskAssignRequests.set(creepName, taskRequest)
  }
}
