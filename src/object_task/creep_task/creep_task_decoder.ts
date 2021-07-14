import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { isV6CreepMemory } from "prototype/creep"
import { CreepTaskState } from "./creep_task_state"
import { CreepTask } from "./creep_task"
import { MoveToTargetTask, MoveToTargetTaskState } from "./task/move_to_target_task"

export type CreepTaskType = keyof CreepTaskDecoderMap
class CreepTaskDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "MoveToTargetTask" = (state: CreepTaskState) => MoveToTargetTask.decode(state as MoveToTargetTaskState)
}
const decoderMap = new CreepTaskDecoderMap()

export function decodeCreepTask(creep: Creep): CreepTask | null {
  if (!isV6CreepMemory(creep.memory)) {
    return null
  }
  const state = creep.memory.t
  if (state == null) {
    return null
  }
  return decodeCreepTaskFromState(state)
}

export function decodeCreepTaskFromState(state: CreepTaskState): CreepTask | null {
  const result = ErrorMapper.wrapLoop((): CreepTask | false => {
    const decoder = decoderMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (task type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
      return false
    }
    return decoder(state) ?? false
  }, `decodeCreepTaskFromState(), objective type: ${state.t}`)()

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
