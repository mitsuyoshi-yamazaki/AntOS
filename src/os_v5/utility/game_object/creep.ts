import { AnyProcessId } from "os_v5/process/process"
import { SpawnedCreep } from "shared/utility/creep"
import { SerializableObject } from "../types"
import { CreepActions } from "./creep_action"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type V5CreepMemoryReservedProperties = { v: any } | { p: any } // v, p は ProcessManager が予約
export type ExtendedV5CreepMemory<M extends SerializableObject> = M extends V5CreepMemoryReservedProperties ? never : M

export type V5CreepMemory<M extends SerializableObject> = {
  readonly v: "o5"  // アプリケーションの"v5"がすでに存在するため
  p: AnyProcessId | null /// リアロケーション可能
} & M

export type V5Creep<M extends SerializableObject> = Omit<Creep, "memory"> & {
  readonly executedActions: Set<CreepActions>
  readonly memory: V5CreepMemory<M>
}
export type V5SpawnedCreep<M extends SerializableObject> = Omit<SpawnedCreep, "memory"> & {
  readonly executedActions: Set<CreepActions>
  readonly memory: V5CreepMemory<M>
}

export type AnyV5CreepMemory = V5CreepMemory<SerializableObject>
export type AnyV5Creep = V5Creep<SerializableObject>


// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const isV5CreepMemory = (creepMemory: Record<string, any>): creepMemory is AnyV5CreepMemory => {
  return (creepMemory as Partial<AnyV5CreepMemory>).v === "o5"
}

export const isV5Creep = (creep: Omit<Creep, "memory">): creep is AnyV5Creep => isV5CreepMemory((creep as Creep).memory)
export const isSpawnedV5Creep = <M extends SerializableObject>(creep: V5Creep<M>): creep is V5SpawnedCreep<M> => creep.ticksToLive != null
