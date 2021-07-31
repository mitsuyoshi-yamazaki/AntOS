import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { SquadTask } from "./Squad_task"
import { SquadTaskState } from "./squad_task_state"
import { MoveToRoomSquadTask, MoveToRoomSquadTaskState } from "./task/move_to_room_squad_task"

export type SquadTaskType = keyof SquadTaskDecoderMap
class SquadTaskDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "MoveToRoomSquadTask" = (state: SquadTaskState) => MoveToRoomSquadTask.decode(state as MoveToRoomSquadTaskState)
}
const decoderMap = new SquadTaskDecoderMap()

export function decodeSquadTaskFromState(state: SquadTaskState): SquadTask | null {
  const result = ErrorMapper.wrapLoop((): SquadTask | false => {
    const decoder = decoderMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (task type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
      return false
    }
    return decoder(state) ?? false
  }, `decodeSquadTaskFromState(), objective type: ${state.t}`)()

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
