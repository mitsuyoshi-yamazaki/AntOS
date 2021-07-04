import { CreepTask as OldCreepTask } from "game_object_task/creep_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"
import { CreepTaskState } from "task/creep_task/creep_task"
import { RoomName } from "./room"

// ---- Types and Constants ---- //
export type CreepName = string

export type CreepRoleHarvester = "harvester"
export type CreepRoleHauler = "hauler"
export type CreepRoleWorker = "worker"
export type CreepRoleScout = "scout"

export const creepRoleHarvester: CreepRoleHarvester = "harvester"
export const creepRoleHauler: CreepRoleHauler = "hauler"
export const creepRoleWorker: CreepRoleWorker = "worker"
export const creepRoleScout: CreepRoleScout = "scout"

export type CreepRole = CreepRoleHarvester | CreepRoleHauler | CreepRoleWorker | CreepRoleScout


// ---- Custon Error Code ---- //
export type ERR_PROGRAMMING_ERROR = 967
export const ERR_PROGRAMMING_ERROR: ERR_PROGRAMMING_ERROR = 967


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
    /** @deprecated */
    v4Task: OldCreepTask | null

    /** @deprecated */
    _v4Task: OldCreepTask | null
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(Creep.prototype, "v4Task", {
    get(): OldCreepTask | null {
      return this._v4Task
    },
    set(v4Task: OldCreepTask | null): void {
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
