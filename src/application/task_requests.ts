import type { CreepName } from "prototype/creep"
import type { RoomName } from "utility/room_name"
import type { Problem } from "./problem"
import type { TaskLogRequest } from "./task_logger"
import type { CreepTaskAssignTaskRequest, SpawnTaskRequestType, TowerActionTaskRequest } from "./task_request"

export interface TaskRequests {
  creepTaskAssignRequests: Map<RoomName, CreepTaskAssignTaskRequest>
  spawnRequests: SpawnTaskRequestType[]
  towerRequests: TowerActionTaskRequest[]
  problems: Problem[]
  logs: TaskLogRequest[]
}

export function emptyTaskRequests(): TaskRequests {
  return {
    creepTaskAssignRequests: new Map<CreepName, CreepTaskAssignTaskRequest>(),
    spawnRequests: [],
    towerRequests: [],
    problems: [],
    logs: [],
  }
}
