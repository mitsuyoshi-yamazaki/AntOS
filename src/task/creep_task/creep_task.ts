import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { isV5CreepMemory } from "prototype/creep"
import { Task, TaskProgressType, TaskState } from "task/task"
import { MoveHarvestEnergyTask, MoveHarvestEnergyTaskState } from "./conbined_task/move_harvest_energy_task"
import { MoveToTargetTask, MoveToTargetTaskState } from "./conbined_task/move_to_target_task"

export interface CreepTaskState extends TaskState {
  /** type identifier */
  t: keyof CreepTaskDecoderMap
}

export interface CreepTask extends Task<Creep> {
  shortDescription?: string

  encode(): CreepTaskState
  run(creep: Creep): TaskProgressType
}

class CreepTaskDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  /** general task */
  "MoveToTargetTask" = (state: CreepTaskState) => MoveToTargetTask.decode(state as MoveToTargetTaskState)

  /** combined task */
  "MoveHarvestEnergyTask" = (state: CreepTaskState) => MoveHarvestEnergyTask.decode(state as MoveHarvestEnergyTaskState)
}
const decoderMap = new CreepTaskDecoderMap()

export function decodeCreepTask(creep: Creep): CreepTask | null {
  if (!isV5CreepMemory(creep.memory)) {
    return null
  }
  const state = creep.memory.t
  if (state == null) {
    return null
  }
  return decodeCreepTaskFromState(state)
}

export function decodeCreepTaskFromState(state: CreepTaskState): CreepTask | null {
  const result = ErrorMapper.wrapLoop((): CreepTask | null => {
    const decoder = decoderMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (task type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
      return null
    }
    return decoder(state)
  }, `decodeCreepTaskFromState(), objective type: ${state.t}`)()

  if (result == null) {
    const message = `Decode failed by program bug (task type identifier: ${state.t})`
    PrimitiveLogger.fatal(message)
    return null
  }
  return result
}
