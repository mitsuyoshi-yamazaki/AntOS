import type { CreepName } from "prototype/creep"
import type { Problem } from "./problem"
import type { TaskLogRequest } from "./task_logger"
import type { CreepTaskAssignTaskRequest, SpawnTaskRequestType, TowerActionTaskRequest } from "./task_request"

export interface TaskOutputs<OutputType, ProblemTypes extends Problem> {
  output: OutputType | null
  creepTaskAssignRequests: Map<CreepName, CreepTaskAssignTaskRequest>
  spawnRequests: SpawnTaskRequestType[]
  towerRequests: TowerActionTaskRequest[]
  problems: ProblemTypes[]
  logs: TaskLogRequest[]
}

export function emptyTaskOutputs<OutputType, ProblemTypes extends Problem>(): TaskOutputs<OutputType, ProblemTypes> {
  return {
    output: null,
    creepTaskAssignRequests: new Map<CreepName, CreepTaskAssignTaskRequest>(),
    spawnRequests: [],
    towerRequests: [],
    problems: [],
    logs: [],
  }
}
