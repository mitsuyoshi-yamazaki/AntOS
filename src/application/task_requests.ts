import type { CreepName } from "prototype/creep"
import type { RoomName } from "utility/room_name"
import type { TaskLogRequest } from "./task_logger"
import type { CreepTaskAssignTaskRequest, SpawnTaskRequestType, TowerActionTaskRequest } from "./task_request"

export interface TaskRequests<P> {
  creepTaskAssignRequests: Map<RoomName, CreepTaskAssignTaskRequest>
  spawnRequests: SpawnTaskRequestType[]
  towerRequests: TowerActionTaskRequest[]
  problems: P[]
  logs: TaskLogRequest[]
}

export function emptyTaskRequests<T>(): TaskRequests<T> {
  return {
    creepTaskAssignRequests: new Map<CreepName, CreepTaskAssignTaskRequest>(),
    spawnRequests: [],
    towerRequests: [],
    problems: [],
    logs: [],
  }
}
