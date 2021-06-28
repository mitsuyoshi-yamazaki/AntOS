import { ErrorMapper } from "error_mapper/ErrorMapper"
import { GameObjectTask, GameObjectTaskState } from "./game_object_task"
import { TowerAttackTask, TowerAttackTaskState } from "./tower_task/tower_attack_task"

export interface StructureTowerTaskState extends GameObjectTaskState {
  /** type identifier */
  t: keyof TowerTaskTypes
}

export interface StructureTowerTask extends GameObjectTask<StructureTower> {
  encode(): StructureTowerTaskState
}

class TowerTaskTypes {
  "AttackTask" = (state: StructureTowerTaskState) => TowerAttackTask.decode(state as TowerAttackTaskState)
}

export function decodeTowerTask(towerId: Id<StructureTower>): StructureTowerTask | null {
  const state = Memory.towers[towerId]?.ts
  if (state == null) {
    return null
  }
  let decoded: StructureTowerTask | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new TowerTaskTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeTowerTask(), objective type: ${state.t}`)()
  return decoded
}
