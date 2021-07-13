import type { Problem } from "./problem"
import { TaskLogRequest } from "./task_logger"
import type { CreepTaskAssignTaskRequest, SpawnTaskRequestType, TowerActionTaskRequest } from "./task_request"

export interface TaskRequests {
  creepTaskAssignRequests: CreepTaskAssignTaskRequest[]
  spawnRequests: SpawnTaskRequestType[]
  towerRequests: TowerActionTaskRequest[]
  problems: Problem[]
  logs: TaskLogRequest[]
}
