import { ErrorMapper } from "error_mapper/ErrorMapper"
import { DecodeFailureTask } from "task/failure_task"
import { Task, TaskProgressType, TaskState } from "task/task"
import { MoveToTargetTask, MoveToTargetTaskState } from "./conbined_task/move_to_target_task"
import { HarvestEnergyTask, HarvestEnergyTaskState } from "./primitive_task/harvest_energy_task"
import { MoveTask, MoveTaskState } from "./primitive_task/move_task"

export type CreepTaskSuccededDidRun = boolean
export type CreepTaskProgressType<E> = TaskProgressType<void, CreepTaskSuccededDidRun, E>

export interface CreepTaskState extends TaskState {
  /** type identifier */
  t: keyof CreepTaskDecoderMap
}

export interface CreepTask<E> extends Task<Creep, void, CreepTaskSuccededDidRun, E> {
  encode(): CreepTaskState
  run(creep: Creep): CreepTaskProgressType<E>
}

type CreepTaskTypes = CreepDecodeFailureTask
  | MoveToTargetTask
  | HarvestEnergyTask
  | MoveTask

class CreepTaskDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  /** general task */
  "MoveToTargetTask" = (state: CreepTaskState) => MoveToTargetTask.decode(state as MoveToTargetTaskState)

  /** primitive task */
  "HarvestEnergyTask" = (state: CreepTaskState) => HarvestEnergyTask.decode(state as HarvestEnergyTaskState)
  "MoveTask" = (state: CreepTaskState) => MoveTask.decode(state as MoveTaskState)

  /** combined task */
}
const decoderMap = new CreepTaskDecoderMap()

// export function decodeCreepTask(creep: Creep): CreepTask | null {
//   const state = creep.memory.ts
//   if (state == null) {
//     return null
//   }
//   return decodeCreepTaskFromState(state)
// }

export function decodeCreepTaskFromState(state: CreepTaskState): CreepTaskTypes | null {
  return ErrorMapper.wrapLoop((): CreepTaskTypes | null => {
    const decoder = decoderMap[state.t]
    if (decoder == null) {
      return null
    }
    return decoder(state)
  }, `decodeCreepTaskFromState(), objective type: ${state.t}`)()
}

export class CreepDecodeFailureTask extends DecodeFailureTask<Creep> {
}
