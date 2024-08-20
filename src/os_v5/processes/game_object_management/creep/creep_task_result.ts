import type { CreepTask } from "./creep_task/creep_task"

// Result
export type CreepTaskResult = {
  readonly taskType: "Sequential"
  readonly result: CreepTask.Results.SequentialResult
} | {
  readonly taskType: "MoveToRoom"
  readonly result: CreepTask.Results.MoveToRoomResult
} | {
  readonly taskType: "MoveTo"
  readonly result: CreepTask.Results.MoveToResult
} | {
  readonly taskType: "Build"
  readonly result: CreepTask.Results.BuildResult
} | {
  readonly taskType: "ClaimController"
  readonly result: CreepTask.Results.ClaimControllerResult
} | {
  readonly taskType: "DropAllResources"
  readonly result: CreepTask.Results.DropAllResourcesResult
} | {
  readonly taskType: "DropResource"
  readonly result: CreepTask.Results.DropResourceResult
} | {
  readonly taskType: "HarvestEnergy"
  readonly result: CreepTask.Results.HarvestEnergyResult
} | {
  readonly taskType: "UpgradeController"
  readonly result: CreepTask.Results.UpgradeControllerResult
} | {
  readonly taskType: "WithdrawResource"
  readonly result: CreepTask.Results.WithdrawResourceResult
} | {
  readonly taskType: "TrafficManagedMove"
  readonly result: CreepTask.Results.TrafficManagedMoveResult
} | {
  readonly taskType: "TargetRoomObject"
  readonly result: CreepTask.Results.TargetRoomObjectResult
}

// Error
export type CreepTaskError = {
  readonly taskType: "Sequential"
  readonly error: CreepTask.Errors.SequentialError
} | {
  readonly taskType: "MoveToRoom"
  readonly error: CreepTask.Errors.MoveToRoomError
} | {
  readonly taskType: "MoveTo"
  readonly error: CreepTask.Errors.MoveToError
} | {
  readonly taskType: "Build"
  readonly error: CreepTask.Errors.BuildError
} | {
  readonly taskType: "ClaimController"
  readonly error: CreepTask.Errors.ClaimControllerError
} | {
  readonly taskType: "DropAllResources"
  readonly error: CreepTask.Errors.DropAllResourcesError
} | {
  readonly taskType: "DropResource"
  readonly error: CreepTask.Errors.DropResourceError
} | {
  readonly taskType: "HarvestEnergy"
  readonly error: CreepTask.Errors.HarvestEnergyError
} | {
  readonly taskType: "UpgradeController"
  readonly error: CreepTask.Errors.UpgradeControllerError
} | {
  readonly taskType: "WithdrawResource"
  readonly error: CreepTask.Errors.WithdrawResourceError
} | {
  readonly taskType: "TrafficManagedMove"
  readonly error: CreepTask.Errors.TrafficManagedMoveError
} | {
  readonly taskType: "TargetRoomObject"
  readonly error: CreepTask.Errors.TargetRoomObjectError
}

