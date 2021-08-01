import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { isV5CreepMemory } from "prototype/creep"
import { MoveHarvestEnergyTask, MoveHarvestEnergyTaskState } from "./combined_task/move_harvest_energy_task"
import { MoveToRoomTask, MoveToRoomTaskState } from "./meta_task/move_to_room_task"
import { MoveToTargetTask, MoveToTargetTaskState } from "./combined_task/move_to_target_task"
import { SequentialTask, SequentialTaskState } from "./combined_task/sequential_task"
import { MoveClaimControllerTask, MoveClaimControllerTaskState } from "./combined_task/move_claim_controller_task"
import { MoveToTask, MoveToTaskState } from "./meta_task/move_to_task"
import { RunApiTask, RunApiTaskState } from "./combined_task/run_api_task"
import { RunApisTask, RunApisTaskState } from "./combined_task/run_apis_task"
import { MoveToTransferHaulerTask, MoveToTransferHaulerTaskState } from "./combined_task/move_to_transfer_hauler_task"
import { EndlessTask, EndlessTaskState } from "./meta_task/endless_task"
import { CreepTaskState } from "./creep_task_state"
import { CreepTask } from "./creep_task"
import { TargetToPositionTask, TargetToPositionTaskState } from "./meta_task/target_to_position_task"
import { TestRunHaulerTask, TestRunHaulerTaskState } from "./meta_task/test_run_hauler_task"
import { SwampRunnerTransferTask, SwampRunnerTransferTaskState } from "./meta_task/swamp_runner_transfer_task"
import { FleeFromAttackerTask, FleeFromAttackerTaskState } from "./combined_task/flee_from_attacker_task"

export type CreepTaskType = keyof CreepTaskDecoderMap
class CreepTaskDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  // ---- Combined task ---- //
  "MoveHarvestEnergyTask" = (state: CreepTaskState) => MoveHarvestEnergyTask.decode(state as unknown as MoveHarvestEnergyTaskState)
  "MoveToTargetTask" = (state: CreepTaskState) => MoveToTargetTask.decode(state as unknown as MoveToTargetTaskState)
  "SequentialTask" = (state: CreepTaskState) => {
    const children: (CreepTask | null)[] = (state as unknown as SequentialTaskState).c.map(childState => decodeCreepTaskFromState(childState))
    return SequentialTask.decode(state as unknown as SequentialTaskState, children)
  }
  "MoveClaimControllerTask" = (state: CreepTaskState) => MoveClaimControllerTask.decode(state as unknown as MoveClaimControllerTaskState)
  "RunApiTask" = (state: CreepTaskState) => RunApiTask.decode(state as unknown as RunApiTaskState)
  "RunApisTask" = (state: CreepTaskState) => RunApisTask.decode(state as unknown as RunApisTaskState)
  "MoveToTransferHaulerTask" = (state: CreepTaskState) => MoveToTransferHaulerTask.decode(state as unknown as MoveToTransferHaulerTaskState)
  "FleeFromAttackerTask" = (state: CreepTaskState) => {
    const fleeFromAttackerTaskState = state as unknown as FleeFromAttackerTaskState
    const childTask = decodeCreepTaskFromState(fleeFromAttackerTaskState.childTaskState)
    if (childTask == null) {
      return null
    }
    return FleeFromAttackerTask.decode(fleeFromAttackerTaskState, childTask)
  }

  // ---- Meta task ---- //
  "MoveToRoomTask" = (state: CreepTaskState) => MoveToRoomTask.decode(state as unknown as MoveToRoomTaskState)
  "MoveToTask" = (state: CreepTaskState) => MoveToTask.decode(state as unknown as MoveToTaskState)
  "EndlessTask" = (state: CreepTaskState) => EndlessTask.decode(state as unknown as EndlessTaskState)
  "TargetToPositionTask" = (state: CreepTaskState) => TargetToPositionTask.decode(state as unknown as TargetToPositionTaskState)
  "SwampRunnerTransferTask" = (state: CreepTaskState) => SwampRunnerTransferTask.decode(state as unknown as SwampRunnerTransferTaskState)

  // ---- Test Task ---- //
  "TestRunHaulerTask" = (state: CreepTaskState) => TestRunHaulerTask.decode(state as unknown as TestRunHaulerTaskState)
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
