import { Objective, ObjectiveFailed, ObjectiveInProgress } from "old_objective/objective"
import { OwnedRoomObjects } from "world_info/room_info"
import { SpawnCreepObjective } from "old_objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"

export interface WorkerObjectiveEvent {
  diedWorkers: number
  workers: number
  queueingWorkers: number
}

export type WorkerObjectiveProgressType = ObjectiveInProgress<WorkerObjectiveEvent> | ObjectiveFailed<string>

export interface WorkerObjective extends Objective {
  objectiveType: "worker"

  addCreeps(names: CreepName[]): void
  didSpawnCreep(creepNames: CreepName[]): void
  didCancelCreep(creepNames: CreepName[]): void
  progress(roomObjects: OwnedRoomObjects, spawnCreepObjective: SpawnCreepObjective): WorkerObjectiveProgressType
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isWorkerObjective(arg: any): arg is WorkerObjective {
  return arg.objectiveType === "worker"
}
