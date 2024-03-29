import { CreepTask as V5CreepTask } from "v5_object_task/creep_task/creep_task"
import { ShortVersion, ShortVersionV5, ShortVersionV6 } from "shared/utility/system_info"
import { CreepRole } from "./creep_role"
import { TaskTargetCache as V5TaskTargetCache } from "v5_object_task/object_task_target_cache"
import type { TaskIdentifier as V5TaskIdentifier } from "v5_task/task"
import type { RoomName } from "shared/utility/room_name_types"
import type { CreepTaskState as V5CreepTaskState } from "v5_object_task/creep_task/creep_task_state"
import type { TaskIdentifier } from "application/task_identifier"
import type { CreepTaskState } from "object_task/creep_task/creep_task_state"
import { CreepTask } from "object_task/creep_task/creep_task"
import { TaskRunnerInfo, TaskTargetCache, TaskTargetCacheTaskType } from "object_task/object_task_target_cache"
import { TravelToState } from "./travel_to"

// ---- Types and Constants ---- //
export type CreepName = string

export function defaultMoveToOptions(): MoveToOpts {
  return {
    maxRooms: 1,
    reusePath: 5,
    maxOps: 800,
  }
}

export function interRoomMoveToOptions(): MoveToOpts {
  return {
    maxRooms: 3,
    reusePath: 20,
    maxOps: 1500,
  }
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

export interface V6Creep extends Creep {
  task: CreepTask | null

  memory: V6CreepMemory
}

// ---- Prototype ---- //
declare global {
  interface Creep {
    /** @deprecated */
    v5task: V5CreepTask | null

    /** @deprecated 外部呼び出しを想定していないのでとりあえずdeprecatedにしている */
    _v5task: V5CreepTask | null

    /** @deprecated */
    roles: CreepRole[]

    targetedBy(taskType: TaskTargetCacheTaskType): TaskRunnerInfo[]
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isAnyCreep(arg: any): arg is AnyCreep {
  return (arg instanceof Creep) || (arg instanceof PowerCreep)
}

// ---- Memory ---- //
export type CreepMemory = V6CreepMemory | V5CreepMemory

interface CreepBaseMemory {
  v: ShortVersionV5 | ShortVersionV6

  /** parent room name */
  p: RoomName

  /** notifyWhenAttacked() set */ // 設定（無効化）したという情報しか格納していない=再度有効化するならもうひとつフラグが必要
  n: boolean

  tr?: TravelToState
}

declare global {
  interface CreepMemory extends CreepBaseMemory { }
}

export interface V6CreepMemory extends CreepBaseMemory {
  /** system version */
  v: ShortVersionV6

  /** task */
  t: CreepTaskState | null

  /** task runner id */
  i: TaskIdentifier

  /** creep identifier */
  ci: string | null
}

export function isCreepMemory(memory: globalThis.CreepMemory): memory is CreepMemory {
  if (isV6CreepMemory(memory)) {
    return true
  }
  if (isV5CreepMemory(memory)) {
    return true
  }
  return false
}

export function isV6Creep(creep: Creep): creep is V6Creep {
  return isV6CreepMemory(creep.memory)
}

export function isV6CreepMemory(memory: globalThis.CreepMemory): memory is V6CreepMemory {
  return (memory as { v: ShortVersion }).v === ShortVersion.v6
}

export interface V5CreepMemory extends CreepBaseMemory {
  /** system version */
  v: ShortVersionV5

  /** roles */
  r: CreepRole[]

  /** task */
  t: V5CreepTaskState | null

  /** task runner id */
  i: V5TaskIdentifier | null
}

export function isV5CreepMemory(memory: globalThis.CreepMemory): memory is V5CreepMemory {
  return (memory as {v: ShortVersion}).v === ShortVersion.v5
}

// サーバーリセット時のみ呼び出し
export function init(): void {
  Object.defineProperty(Creep.prototype, "v5task", {
    get(): V5CreepTask | null {
      return this._v5task
    },
    set(v5task: V5CreepTask | null): void {
      if (this._v5task != null && this._v5task.targetId != null) {
        V5TaskTargetCache.didFinishTask(this.id, this._v5task.targetId)
      }
      if (v5task != null && v5task.targetId != null) {
        V5TaskTargetCache.didAssignTask(this.id, v5task.targetId)
      }

      this._v5task = v5task
    }
  })

  Object.defineProperty(Creep.prototype, "roles", {
    get(): CreepRole[] {
      const memory = this.memory
      if (isV5CreepMemory(memory)) {
        return memory.r.concat([])
      }
      return []
    }
  })

  Creep.prototype.targetedBy = function (taskType: TaskTargetCacheTaskType): TaskRunnerInfo[] {
    return TaskTargetCache.creepTargetingTaskRunnerInfo(this.id, taskType)
  }
}

export function moveToOptions(position: RoomPosition, room: Room, destination: RoomPosition, staying: number): MoveToOpts {
  if (staying > 2) {
    const maxRooms = position.roomName === destination.roomName ? 1 : 2
    const maxOps = position.roomName === destination.roomName ? 1500 : 2000
    return {
      maxRooms,
      reusePath: 3,
      maxOps,
    }
  }

  const inEconomicArea = ((): boolean => {
    if (room.controller == null) {
      return false
    }
    if (room.controller.my === true) {
      return true
    }
    if (room.controller.reservation == null) {
      return false
    }
    if (room.controller.reservation.username === Game.user.name) {
      return true
    }
    return false
  })()

  if (["W27S25"].includes(position.roomName)) { // FixMe:
    const maxRooms = position.roomName === destination.roomName ? 1 : 2
    return {
      maxRooms,
      reusePath: inEconomicArea === true ? 100 : 3,
      maxOps: 4000,
      ignoreCreeps: inEconomicArea === true ? true : false,
    }
  }

  const options = defaultMoveToOptions()
  options.maxRooms = position.roomName === destination.roomName ? 1 : 2
  options.maxOps = position.roomName === destination.roomName ? 500 : 1500
  options.reusePath = inEconomicArea === true ? 100 : 3
  options.ignoreCreeps = inEconomicArea === true ? true : false
  return options
}
