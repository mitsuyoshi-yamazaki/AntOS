import { CreepTask as V4CreepTask } from "game_object_task/creep_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"
import { CreepTask, CreepTaskState } from "task/creep_task/creep_task"
import { RoomName } from "./room"

// ---- Types and Constants ---- //
export type CreepName = string

type CreepRoleHarvester = "hv"
type CreepRoleWorker = "wr"
type CreepRoleEnergyStore = "es"
type CreepRoleHauler = "hl"
type CreepRoleScout = "sc"

export const creepRoleHarvester: CreepRoleHarvester = "hv"
export const creepRoleWorker: CreepRoleWorker = "wr"
export const creepRoleEnergyStore: CreepRoleEnergyStore = "es"
export const creepRoleHauler: CreepRoleHauler = "hl"
export const creepRoleScout: CreepRoleScout = "sc"

export type CreepRole = CreepRoleHarvester | CreepRoleWorker | CreepRoleEnergyStore | CreepRoleHauler | CreepRoleScout

// ---- Custon Return Code ---- //
export type FINISHED = 967
export type IN_PROGRESS = 968
export type ERR_PROGRAMMING_ERROR = 969

export const FINISHED: FINISHED = 967
export const IN_PROGRESS: IN_PROGRESS = 968
export const ERR_PROGRAMMING_ERROR: ERR_PROGRAMMING_ERROR = 969


// ---- Memory ---- //
export interface V5CreepMemory {
  /** parent room name */
  p: RoomName

  /** roles */
  r: CreepRole[]

  /** task */
  t: CreepTaskState | null
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
