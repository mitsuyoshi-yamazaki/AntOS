import { Task } from "application/task"
import type { TaskIdentifier } from "application/task_identifier"
import { CreepTaskAssignTaskRequest } from "application/task_request"
import { TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import type { CreepName } from "prototype/creep"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { Environment } from "utility/environment"
import type { RoomName } from "utility/room_name"
import { Season3FindPowerBankTask, Season3FindPowerBankTaskState } from "./season3_find_power_bank_task"
import { Season3HarvestPowerTask, Season3HarvestPowerTaskState } from "./season3_harvest_power_task"
import { Season3ProcessPowerTask, Season3ProcessPowerTaskState } from "./season3_process_power_task"

export interface Season3PowerManagerTaskState extends TaskState {
  /** child task states */
  c: {
    /** find power bank task */
    f: Season3FindPowerBankTaskState

    /** harvest power task */
    h: Season3HarvestPowerTaskState[]

    /** process power task */
    p: Season3ProcessPowerTaskState
  }
}

/**
 * - 責務: Power Harvestingに関する作業全般
 *   - Find Power Bank
 *   - Harvest Power Bank
 *   - Process Power
 * - [ ] 攻撃を受けたら効率重視から防衛体制へ移行する
 */
export class Season3PowerManagerTask extends Task {
  public readonly taskType = "Season3PowerManagerTask"
  public readonly identifier: TaskIdentifier

  protected constructor(
    public readonly startTime: number,
    public readonly roomName: RoomName,
    protected paused: number | null,
    private readonly findPowerBankTask: Season3FindPowerBankTask,
    private readonly harvestPowerTasks: Season3HarvestPowerTask[],
    private readonly processPowerTask: Season3ProcessPowerTask,
  ) {
    super(startTime, roomName, paused)

    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): Season3PowerManagerTaskState {
    return {
      ...super.encode(),
      c: {
        f: this.findPowerBankTask.encode(),
        h: this.harvestPowerTasks.map(task => task.encode()),
        p: this.processPowerTask.encode()
      },
    }
  }

  public static decode(state: Season3PowerManagerTaskState): Season3PowerManagerTask {
    const findPowerBankTask = Season3FindPowerBankTask.decode(state.c.f)
    const harvestPowerTasks = state.c.h.map(harvestPowerTaskState => Season3HarvestPowerTask.decode(harvestPowerTaskState))
    const processPowerTask = Season3ProcessPowerTask.decode(state.c.p)
    return new Season3PowerManagerTask(state.s, state.r, state.p, findPowerBankTask, harvestPowerTasks, processPowerTask)
  }

  public static create(roomName: RoomName): Season3PowerManagerTask {
    if (Environment.world !== "season 3") {
      // return できないためログ表示のみ
      PrimitiveLogger.programError(`${this.constructor.name} is not supported in ${Environment.world}`)
    }
    const findPowerBankTask = Season3FindPowerBankTask.create(roomName)
    const processPowerTask = Season3ProcessPowerTask.create(roomName)
    return new Season3PowerManagerTask(Game.time, roomName, null, findPowerBankTask, [], processPowerTask)
  }

  public overrideCreepTask(creepName: CreepName, request1: CreepTaskAssignTaskRequest, request2: CreepTaskAssignTaskRequest): CreepTaskAssignTaskRequest {
    PrimitiveLogger.programError(`${this.identifier} overrideCreepTask() is not implemented yet (${request1.task})`)
    return request1
  }

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskOutputs): TaskOutputs {

    return requestsFromChildren
  }
}
