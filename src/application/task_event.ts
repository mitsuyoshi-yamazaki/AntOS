import type { CreepName } from "prototype/creep"
import type { CreepRole } from "prototype/creep_role"

// ---- Creep Spawn ---- //
export interface CreepSpawnTaskEvent {
  creepName: CreepName
  body: BodyPartConstant[]
  roles: CreepRole[]
}

export interface CreepSpawnTaskEventHandler {
  didSpawnCreep(creepSpawnEvent: CreepSpawnTaskEvent): void
  didCancelSpawningCreep(creepSpawnEvent: CreepSpawnTaskEvent): void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isCreepSpawnTaskEventHandler(arg: any): arg is CreepSpawnTaskEventHandler {
  return arg.didSpawnCreep !== undefined && arg.didCancelSpawningCreep !== undefined
}
