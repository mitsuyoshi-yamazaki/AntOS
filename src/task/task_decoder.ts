import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepInsufficiencyProblemSolver, CreepInsufficiencyProblemSolverState } from "./creep_spawn/creep_insufficiency_problem_solver"
import { TowerInterceptionProblemSolver, TowerInterceptionProblemSolverState } from "./defence/tower_interception_problem_solver"
import { HarvesterTask, HarvesterTaskState } from "./harvester/harvester_task"
import { RoomKeeperTask, RoomKeeperTaskState } from "./room_keeper/room_keeper_task"
import { CreateConstructionSiteTask, CreateConstructionSiteTaskState } from "./room_planing/create_construction_site_task"
import { Task, TaskState } from "./task"
import { GeneralWorkerTask, GeneralWorkerTaskState } from "./worker/general_worker_task"
import { PrimitiveWorkerTask, PrimitiveWorkerTaskState } from "./worker/primitive_worker_task"
import { WorkerTask, WorkerTaskState } from "./worker/worker_task"

export type TaskType = keyof TaskMap
class TaskMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "RoomKeeperTask" = (state: TaskState) => RoomKeeperTask.decode(state as RoomKeeperTaskState)
  "TowerInterceptionProblemSolver" = (state: TaskState) => TowerInterceptionProblemSolver.decode(state as TowerInterceptionProblemSolverState)
  "CreateConstructionSiteTask" = (state: TaskState) => CreateConstructionSiteTask.decode(state as CreateConstructionSiteTaskState)
  "PrimitiveWorkerTask" = (state: TaskState) => PrimitiveWorkerTask.decode(state as PrimitiveWorkerTaskState)
  "CreepInsufficiencyProblemSolver" = (state: TaskState) => CreepInsufficiencyProblemSolver.decode(state as CreepInsufficiencyProblemSolverState)
  "HarvesterTask" = (state: TaskState) => HarvesterTask.decode(state as HarvesterTaskState)
  "GeneralWorkerTask" = (state: TaskState) => GeneralWorkerTask.decode(state as GeneralWorkerTaskState)
  "WorkerTask" = (state: TaskState) => WorkerTask.decode(state as WorkerTaskState)
}
const taskMap = new TaskMap()

export function decodeTaskFrom(state: TaskState): Task | null {
  const result = ErrorMapper.wrapLoop((): Task | false => {
    const decoder = taskMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (task type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
      return false
    }
    return decoder(state) ?? false
  }, `decodeTaskFrom(), process type: ${state.t}`)()

  if (result == null) {
    const message = `Decode failed by program bug (task type identifier: ${state.t})`
    PrimitiveLogger.fatal(message)
    return null
  }
  if (result === false) {
    return null
  }
  return result
}

export function decodeTasksFrom(states: TaskState[]): Task[] {
  return states.flatMap(state => {
    const task = decodeTaskFrom(state)
    return task != null ? [task] : []
  })
}
