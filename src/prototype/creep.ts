import { CreepTask as V4CreepTask } from "game_object_task/creep_task"
import { CreepTask, CreepTaskState } from "object_task/creep_task/creep_task"
import { CreepTaskState as V4CreepTaskState } from "game_object_task/creep_task"
import { ShortVersion, ShortVersionV5 } from "utility/system_info"
import { CreepStatus, CreepType } from "_old/creep"
import { RoomName } from "./room"
import { CreepRole } from "./creep_role"
import { TaskTargetCache } from "object_task/object_task_target_cache"
import { TaskIdentifier } from "task/task"

// ---- Types and Constants ---- //
export type CreepName = string

export const defaultMoveToOptions: MoveToOpts = {
  maxRooms: 1,
  reusePath: 1,
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
  /** task state */
  ts: V4CreepTaskState | null

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

    /** @deprecated */
    v4Task: V4CreepTask | null

    /** @deprecated */
    _v4Task: V4CreepTask | null
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(Creep.prototype, "task", {
    get(): CreepTask | null {
      return this._task
    },
    set(task: CreepTask | null): void {
      this.v4Task = null

      if (this._task != null && this._task.targetId != null) {
        TaskTargetCache.didFinishTask(this.id, this._task.targetId)
      }
      if (task != null && task.targetId != null) {
        TaskTargetCache.didAssignTask(this.id, task.targetId)
      }

      this._task = task
      if (task == null) {
        this.say("idle")
      } else if (task.shortDescription != null) {
        this.say(task.shortDescription)
      }
    }
  })

  Object.defineProperty(Creep.prototype, "v4Task", {
    get(): V4CreepTask | null {
      if (this._task != null) {
        return null
      }
      return this._v4Task
    },
    set(v4Task: V4CreepTask | null): void {
      if (this._task != null) {
        return
      }

      if (this._v4Task != null && this._v4Task.targetId != null) {
        TaskTargetCache.didFinishTask(this.id, this._v4Task.targetId)
      }
      if (v4Task != null && v4Task.targetId != null) {
        TaskTargetCache.didAssignTask(this.id, v4Task.targetId)
      }
      this._v4Task = v4Task
      if (v4Task == null) {
        this.say("idle")
      } else if (v4Task.shortDescription != null) {
        this.say(v4Task.shortDescription)
      }
    }
  })
}
