import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomKeeperTask, RoomKeeperTaskState } from "./room_keeper/room_keeper_task"
import { Task } from "./task"
import type { TaskState } from "./task_state"

export type TaskType = keyof TaskMap
class TaskMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "RoomKeeperTask" = (state: TaskState) => RoomKeeperTask.decode(state as unknown as RoomKeeperTaskState, decodeTasksFrom(state.c))
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
