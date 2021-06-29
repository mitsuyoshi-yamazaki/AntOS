import { ErrorMapper } from "error_mapper/ErrorMapper"
import { GameObjectTask, GameObjectTaskState } from "./game_object_task"
import { BuildTask, BuildTaskState } from "./creep_task/build_task"
import { HarvestEnergyTask, HarvestEnergyTaskState } from "./creep_task/harvest_energy_task"
import { TransferToStructureTask, TransferToStructureTaskState } from "./creep_task/transfer_to_structure_task"
import { UpgradeControllerTask, UpgradeControllerTaskState } from "./creep_task/upgrade_controller_task"
import { ClaimControllerTask, ClaimControllerTaskState } from "./creep_task/claim_controller_task"
import { MoveToPortalTask, MoveToPortalTaskState } from "./creep_task/move_to_position_task"

export interface CreepTaskState extends GameObjectTaskState {
  /** type identifier */
  t: keyof CreepTaskTypes
}

export interface CreepTask extends GameObjectTask<Creep> {
  shortDescription: string

  encode(): CreepTaskState
}

class CreepTaskTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestEnergyTask" = (state: CreepTaskState) => HarvestEnergyTask.decode(state as HarvestEnergyTaskState)
  "UpgradeControllerTask" = (state: CreepTaskState) => UpgradeControllerTask.decode(state as UpgradeControllerTaskState)
  "TransferToStructureTask" = (state: CreepTaskState) => TransferToStructureTask.decode(state as TransferToStructureTaskState)
  "BuildTask" = (state: CreepTaskState) => BuildTask.decode(state as BuildTaskState)
  "ClaimControllerTask" = (state: CreepTaskState) => ClaimControllerTask.decode(state as ClaimControllerTaskState)
  "MoveToPortalTask" = (state: CreepTaskState) => MoveToPortalTask.decode(state as MoveToPortalTaskState)
}

export function decodeCreepTask(creep: Creep): CreepTask | null {
  const state = creep.memory.ts
  if (state == null) {
    return null
  }
  let decoded: CreepTask | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new CreepTaskTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeCreepTask(), objective type: ${state.t}`)()
  return decoded
}
