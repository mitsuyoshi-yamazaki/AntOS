import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Task } from "./task"
import type { TaskState } from "./task_state"
import { RoomKeeperTask, RoomKeeperTaskState } from "./task/room_keeper/room_keeper_task"
import { PrimitiveWorkerTask, PrimitiveWorkerTaskState } from "./task/worker/primitive_worker_task"
import { WorkerManagerTask, WorkerManagerTaskState } from "./task/worker/worker_manager_task"
import { Season3PowerManagerTask, Season3PowerManagerTaskState } from "./task/season3_power_harvester/season3_power_manager_task"
import { Season3FindPowerBankTask, Season3FindPowerBankTaskState } from "./task/season3_power_harvester/season3_find_power_bank_task"
import { Season3HarvestPowerTask, Season3HarvestPowerTaskState } from "./task/season3_power_harvester/season3_harvest_power_task"
import { Season3ProcessPowerTask, Season3ProcessPowerTaskState } from "./task/season3_power_harvester/season3_process_power_task"
// import { V5BridgingTask, V5BridgingTaskState } from "./task/v5_bridging/v5_bridging_task"

export type TaskType = keyof TaskMap
class TaskMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "RoomKeeperTask" = (state: TaskState) => RoomKeeperTask.decode(state as unknown as RoomKeeperTaskState)
  "PrimitiveWorkerTask" = (state: TaskState) => PrimitiveWorkerTask.decode(state as unknown as PrimitiveWorkerTaskState)
  "WorkerManagerTask" = (state: TaskState) => WorkerManagerTask.decode(state as unknown as WorkerManagerTaskState)
  "Season3PowerManagerTask" = (state: TaskState) => Season3PowerManagerTask.decode(state as unknown as Season3PowerManagerTaskState)
  "Season3FindPowerBankTask" = (state: TaskState) => Season3FindPowerBankTask.decode(state as unknown as Season3FindPowerBankTaskState)
  "Season3HarvestPowerTask" = (state: TaskState) => Season3HarvestPowerTask.decode(state as unknown as Season3HarvestPowerTaskState)
  "Season3ProcessPowerTask" = (state: TaskState) => Season3ProcessPowerTask.decode(state as unknown as Season3ProcessPowerTaskState)
  // "V5BridgingTask" = (state: TaskState) => V5BridgingTask.decode(state as unknown as V5BridgingTaskState)
}
const taskMap = new TaskMap()

// TODO: 汎用Taskをデコードする場面がないので要らんのでは
// export function decodeTaskFrom(state: TaskState): Task | null {
//   const result = ErrorMapper.wrapLoop((): Task | false => {
//     const decoder = taskMap[state.t]
//     if (decoder == null) {
//       const message = `Decode failed by program bug: missing decoder (task type identifier: ${state.t})`
//       PrimitiveLogger.fatal(message)
//       return false
//     }
//     return decoder(state) ?? false
//   }, `decodeTaskFrom(), process type: ${state.t}`)()

//   if (result == null) {
//     const message = `Decode failed by program bug (task type identifier: ${state.t})`
//     PrimitiveLogger.fatal(message)
//     return null
//   }
//   if (result === false) {
//     return null
//   }
//   return result
// }
