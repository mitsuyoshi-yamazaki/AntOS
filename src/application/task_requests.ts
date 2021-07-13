import type { Problem } from "./problem"
import { TaskLogRequest } from "./task_logger"
import type { CreepTaskAssignTaskRequest, SpawnTaskRequest, TowerActionTaskRequest } from "./task_request"

export interface TaskRequests {
  creepTaskAssignRequests: CreepTaskAssignTaskRequest[]
  spawnRequests: SpawnTaskRequest[]
  towerRequests: TowerActionTaskRequest[]
  problems: Problem[]
  logs: TaskLogRequest[]
}
