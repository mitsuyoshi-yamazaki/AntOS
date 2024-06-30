import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { canExecuteAction, CreepActions } from "os_v5/utility/game_object/creep_action"
import { SerializableObject } from "os_v5/utility/types"
import { reverseConstMapping, ReversedMapping } from "shared/utility/strict_entries"


export const taskTypeDecodingMap = {
  a: "MoveTo",
  b: "HarvestEnergy",
  c: "Sequential",
  d: "ClaimController",
  e: "TargetRoomObject",
  f: "MoveToRoom",
  g: "UpgradeController",
  h: "WithdrawResource",
} as const

export type TaskTypeEncodingMap = ReversedMapping<typeof taskTypeDecodingMap>
export const taskTypeEncodingMap = reverseConstMapping(taskTypeDecodingMap)
export type SerializedTaskTypes = keyof typeof taskTypeDecodingMap
export type TaskTypes = keyof typeof taskTypeEncodingMap


export type TaskState = SerializableObject & {
  readonly t: SerializedTaskTypes
}

export type TaskResult = "finished" | "in progress" | "failed" | AnyTask


export abstract class Task<State extends TaskState> {
  abstract readonly actionType: CreepActions | null

  abstract encode(): State

  abstract run(creep: AnyV5Creep): TaskResult

  public canRun(creep: AnyV5Creep): boolean {
    if (this.actionType == null) {
      return true
    }
    return canExecuteAction(this.actionType, creep.executedActions)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTask = Task<TaskState>
