import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { ShortVersion, ShortVersionV5 } from "utility/system_info"
import { CreepStatus, CreepType } from "_old/creep"
import { CreepRole } from "./creep_role"
import { TaskTargetCache } from "v5_object_task/object_task_target_cache"
import { TaskIdentifier } from "v5_task/task"
import { RoomName } from "utility/room_name"
import type { CreepTaskState } from "v5_object_task/creep_task/creep_task_state"

// ---- Types and Constants ---- //
export type CreepName = string

export const defaultMoveToOptions: MoveToOpts = {
  maxRooms: 1,
  reusePath: 3,
  maxOps: 500,
}

export const interRoomMoveToOptions: MoveToOpts = {
  maxRooms: 3,
  reusePath: 3,
  maxOps: 500,
}

// ---- Custon Return Code ---- //
export type FINISHED_AND_RAN = 967
export type FINISHED = 968
export type IN_PROGRESS = 969
export type ERR_DAMAGED = 970
export type ERR_PROGRAMMING_ERROR = 971

export const FINISHED_AND_RAN: FINISHED_AND_RAN = 967
export const FINISHED: FINISHED = 968
export const IN_PROGRESS: IN_PROGRESS = 969
export const ERR_DAMAGED: ERR_DAMAGED = 970
export const ERR_PROGRAMMING_ERROR: ERR_PROGRAMMING_ERROR = 971


// ---- Memory ---- //
export type CreepMemory = V5CreepMemory | V4CreepMemory

export interface V5CreepMemory {
  /** system version */
  v: ShortVersionV5

  /** parent room name */
  p: RoomName

  /** roles */
  r: CreepRole[]

  /** task */
  t: CreepTaskState | null

  /** task runner id */
  i: TaskIdentifier | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isV5CreepMemory(arg: any): arg is V5CreepMemory {
  return arg.v === ShortVersion.v5
}

export interface V4CreepMemory {
  /** @deprecated Old codebase */
  squad_name: string

  /** @deprecated Old codebase */
  status: CreepStatus

  /** @deprecated Old codebase */
  type: CreepType

  /** @deprecated Old codebase */
  birth_time: number

  /** @deprecated Old codebase */
  should_silent?: boolean

  /** @deprecated Old codebase */
  should_notify_attack: boolean

  /** @deprecated Old codebase */
  let_thy_die: boolean

  /** @deprecated Old codebase */
  debug?: boolean

  /** @deprecated Old codebase */
  stop?: boolean

  /** @deprecated Old codebase */
  destination_room_name?: string

  /** @deprecated Old codebase */
  withdraw_target?: string            // something that has energy

  /** @deprecated Old codebase */
  withdraw_resources_target?: string  // something that has store

  /** @deprecated Old codebase */
  pickup_target?: string

  /** @deprecated Old codebase */
  no_path?: DirectionConstant
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isV4CreepMemory(arg: any): arg is V4CreepMemory {
  return arg.v == null
}


// ---- Prototype ---- //
declare global {
  interface Creep {
    task: CreepTask | null

    /** @deprecated 外部呼び出しを想定していないのでとりあえずdeprecatedにしている */
    _task: CreepTask | null

    roles: CreepRole[]
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(Creep.prototype, "task", {
    get(): CreepTask | null {
      return this._task
    },
    set(task: CreepTask | null): void {
      if (this._task != null && this._task.targetId != null) {
        TaskTargetCache.didFinishTask(this.id, this._task.targetId)
      }
      if (task != null && task.targetId != null) {
        TaskTargetCache.didAssignTask(this.id, task.targetId)
      }

      this._task = task
    }
  })

  Object.defineProperty(Creep.prototype, "roles", {
    get(): CreepRole[] {
      const memory = this.memory
      if (!isV5CreepMemory(memory)) {
        return []
      }
      return memory.r.concat([])
    }
  })
}
