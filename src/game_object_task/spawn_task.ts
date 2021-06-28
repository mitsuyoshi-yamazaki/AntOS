import { ErrorMapper } from "error_mapper/ErrorMapper"
import { GameObjectTask, GameObjectTaskState } from "./game_object_task"
import { SpawnCreepTask, SpawnCreepTaskState } from "./spwan_task/spawn_creep_task"

export interface StructureSpawnTaskState extends GameObjectTaskState {
  /** type identifier */
  t: keyof SpawnTaskTypes
}

export interface StructureSpawnTask extends GameObjectTask<StructureSpawn> {
  taskType: keyof SpawnTaskTypes

  encode(): StructureSpawnTaskState
}

class SpawnTaskTypes {
  "SpawnCreepTask" = (state: StructureSpawnTaskState) => SpawnCreepTask.decode(state as SpawnCreepTaskState)
}

export function decodeSpawnTask(spawn: StructureSpawn): StructureSpawnTask | null {
  const state = spawn.memory.ts
  if (state == null) {
    return null
  }
  let decoded: StructureSpawnTask | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new SpawnTaskTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeSpawnTask(), objective type: ${state.t}`)()
  return decoded
}
