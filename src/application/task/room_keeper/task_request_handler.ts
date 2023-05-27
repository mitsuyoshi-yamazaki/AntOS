import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepTaskAssignRequestHandler } from "./task_request_handler/creep_task_assign_request_handler"
import { RoomKeeperLogAggregator } from "./task_request_handler/room_keeper_log_aggregator"
import { RoomKeeperProblemSolver, RoomKeeperTaskProblemTypes } from "./task_request_handler/room_keeper_problem_solver"
import { SpawnRequestHandler } from "./task_request_handler/spawn_request_handler"
import { TowerRequestHandler } from "./task_request_handler/tower_request_handler"
import type { TaskLogRequest } from "application/task_logger"
import type { CreepName } from "prototype/creep"
import { CreepTaskAssignTaskRequest, SpawnTaskRequestType, TowerActionTaskRequest } from "application/task_request"
import type { AnyTaskProblem } from "application/any_problem"
import type { RoomName } from "shared/utility/room_name_types"

export interface TaskRequestHandlerInputs {
  creepTaskAssignRequests: Map<CreepName, CreepTaskAssignTaskRequest>
  spawnRequests: SpawnTaskRequestType[]
  towerRequests: TowerActionTaskRequest[]
  problems: AnyTaskProblem[]
  logs: TaskLogRequest[]
}

interface TaskRequestHandlerResult {
  unresolvedProblems: RoomKeeperTaskProblemTypes[]
  logs: TaskLogRequest[]
}

export class TaskRequestHandler {
  private readonly creepTaskAssignRequestHandler = new CreepTaskAssignRequestHandler()
  private readonly spawnRequestHandler: SpawnRequestHandler
  private readonly towerRequestHandler = new TowerRequestHandler()
  private readonly problemSolver = new RoomKeeperProblemSolver()
  private readonly logAggregator = new RoomKeeperLogAggregator()

  public constructor(
    public readonly roomName: RoomName,
  ) {
    this.spawnRequestHandler = new SpawnRequestHandler(this.roomName)
  }

  /**
   * @returns Unresolved requests
   */
  public execute(
    roomResource: OwnedRoomResource,
    inputs: TaskRequestHandlerInputs,
  ): TaskRequestHandlerResult {

    this.creepTaskAssignRequestHandler.execute(inputs.creepTaskAssignRequests, roomResource)
    const spawnLog = this.spawnRequestHandler.execute(inputs.spawnRequests, roomResource)
    this.towerRequestHandler.execute(inputs.towerRequests, roomResource)
    const aggregatedLogs = this.logAggregator.execute(inputs.logs, roomResource)

    return {
      unresolvedProblems: this.problemSolver.execute(inputs.problems, roomResource),
      logs: aggregatedLogs.concat(spawnLog),
    }
  }
}
