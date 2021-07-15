import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomKeeperTask, RoomKeeperTaskState } from "./task/room_keeper/room_keeper_task"
import { Task } from "./task"
import type { TaskState } from "./task_state"
import { PrimitiveWorkerTask, PrimitiveWorkerTaskState } from "./task/worker/primitive_worker_task"
import { WorkerManagerTask, WorkerManagerTaskState } from "./task/worker/worker_manager_task"

type AnyTask = RoomKeeperTask
  | PrimitiveWorkerTask
  | WorkerManagerTask

export type TaskType = keyof TaskMap
class TaskMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "RoomKeeperTask" = (state: TaskState) => RoomKeeperTask.decode(state as unknown as RoomKeeperTaskState)
  "PrimitiveWorkerTask" = (state: TaskState) => PrimitiveWorkerTask.decode(state as unknown as PrimitiveWorkerTaskState)
  "WorkerManagerTask" = (state: TaskState) => WorkerManagerTask.decode(state as unknown as WorkerManagerTaskState)
}
const taskMap = new TaskMap()

export function decodeTaskFrom(state: TaskState): AnyTask | null {
  const result = ErrorMapper.wrapLoop((): AnyTask | false => {
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
