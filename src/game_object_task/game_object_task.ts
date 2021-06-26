import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { HarvestTask, HarvestTaskState } from "./creep_task/harvest_task"
import { TransferToStructureTask, TransferToStructureTaskState } from "./creep_task/transfer_to_structure_task"
import { UpgradeControllerTask, UpgradeControllerTaskState } from "./creep_task/upgrade_controller_task"

export interface GameObjectTaskState extends State {
  /** start time */
  s: number

  /** type identifier */
  t: keyof TaskTypes
}

export type GameObjectTaskReturnCode = "finished" | "in progress" | "failed"

export interface GameObjectTask<T> extends Stateful {
  startTime: number
  taskType: keyof TaskTypes

  encode(): GameObjectTaskState
  run(obj: T): GameObjectTaskReturnCode
}

class TaskTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestTask" = (state: GameObjectTaskState) => HarvestTask.decode(state as HarvestTaskState)
  "UpgradeControllerTask" = (state: GameObjectTaskState) => UpgradeControllerTask.decode(state as UpgradeControllerTaskState)
  "TransferToStructureTask" = (state: GameObjectTaskState) => TransferToStructureTask.decode(state as TransferToStructureTaskState)
}

export function decodeCreepTask(creep: Creep): GameObjectTask<Creep> | null {
  const state = creep.memory.ts
  if (state == null) {
    return null
  }
  let decoded: GameObjectTask<Creep> | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new TaskTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeGameObjectTaskFrom(), objective type: ${state.t}`)()
  return decoded
}
