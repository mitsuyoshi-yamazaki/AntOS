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

export interface Season3HarvestPowerTaskState extends TaskState {
  /** child task states */
  c: {
  }
}

export class Season3HarvestPowerTask extends Task {
  public readonly taskType = "Season3HarvestPowerTask"
  public readonly identifier: TaskIdentifier
  public get children(): Task[] {
    return [
    ]
  }

  protected constructor(
    public readonly startTime: number,
    public readonly roomName: RoomName,
    protected paused: number | null,
  ) {
    super(startTime, roomName, paused)

    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): Season3HarvestPowerTaskState {
    return {
      ...super.encode(),
      c: {
      },
    }
  }

  public static decode(state: Season3HarvestPowerTaskState): Season3HarvestPowerTask {
    return new Season3HarvestPowerTask(state.s, state.r, state.p)
  }

  public static create(roomName: RoomName): Season3HarvestPowerTask {
    if (Environment.world !== "season 3") {
      // return できないためログ表示のみ
      PrimitiveLogger.programError(`${this.constructor.name} is not supported in ${Environment.world}`)
    }
    return new Season3HarvestPowerTask(Game.time, roomName, null)
  }

  public overrideCreepTask(creepName: CreepName, request1: CreepTaskAssignTaskRequest, request2: CreepTaskAssignTaskRequest): CreepTaskAssignTaskRequest {
    PrimitiveLogger.programError(`${this.identifier} overrideCreepTask() is not implemented yet (${request1.task})`)
    return request1
  }

  public run(roomResource: OwnedRoomResource, requestsFromChildren: TaskOutputs): TaskOutputs {

    return requestsFromChildren
  }
}
