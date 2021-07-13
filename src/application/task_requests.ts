import type { Problem } from "./problem"
import { TaskLogRequest } from "./task_logger"
import type { CreepTaskAssignTaskRequest, SpawnTaskRequestType, TowerActionTaskRequest } from "./task_request"

export interface TaskRequests<P> {
  creepTaskAssignRequests: CreepTaskAssignTaskRequest[]
  spawnRequests: SpawnTaskRequestType[]
  towerRequests: TowerActionTaskRequest[]
  problems: P[]
  logs: TaskLogRequest[]
}
