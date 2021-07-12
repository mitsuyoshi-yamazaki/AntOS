import type { Problem } from "./problem"
import type { SpawnTaskRequest, TowerActionTaskRequest } from "./task_request"

export interface TaskRequests {
  spawnRequests: SpawnTaskRequest[]
  towerRequests: TowerActionTaskRequest[]
  problems: Problem[]
}
