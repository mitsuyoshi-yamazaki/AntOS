import { TaskRequests } from "application/task_requests"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepTaskAssignRequestHandler } from "./task_request_handler/creep_task_assign_request_handler"
import { RoomKeeperLogAggregator } from "./task_request_handler/room_keeper_log_aggregator"
import { RoomKeeperProblemSolver } from "./task_request_handler/room_keeper_problem_solver"
import { SpawnRequestHandler } from "./task_request_handler/spawn_request_handler"
import { TowerRequestHandler } from "./task_request_handler/tower_request_handler"
import type { Problem } from "application/problem"
import type { TaskLogRequest } from "application/task_logger"

interface TaskRequestHandlerResult {
  unresolvedProblems: Problem[]
  logs: TaskLogRequest[]
}

export class TaskRequestHandler {
  private readonly creepTaskAssignRequestHandler = new CreepTaskAssignRequestHandler()
  private readonly spawnRequestHandler = new SpawnRequestHandler()
  private readonly towerRequestHandler = new TowerRequestHandler()
  private readonly problemSolver = new RoomKeeperProblemSolver()
  private readonly logAggregator = new RoomKeeperLogAggregator()

  /**
   * @returns Unresolved requests
   */
  public execute(taskRequests: TaskRequests, roomResource: OwnedRoomResource): TaskRequestHandlerResult {
    const logs: TaskLogRequest[] = []

    this.creepTaskAssignRequestHandler.execute(taskRequests.creepTaskAssignRequests, roomResource)
    this.spawnRequestHandler.execute(taskRequests.spawnRequests, roomResource)
    this.towerRequestHandler.execute(taskRequests.towerRequests, roomResource)

    return {
      unresolvedProblems: this.problemSolver.execute(taskRequests.problems, roomResource),
      logs,
    }
  }
}
