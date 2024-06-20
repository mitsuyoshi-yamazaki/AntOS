import { AnyProcessId } from "os_v5/process/process"
import { SerializableObject } from "../types"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtendedV5CreepMemory<M extends SerializableObject> = M extends { v: any } | { p: any } ? never : M // v, p は ProcessManager が予約済み

export type V5CreepMemory<M extends SerializableObject> = {
  readonly v: "o5"  // アプリケーションの"v5"がすでに存在するため
  p: AnyProcessId | null /// リアロケーション可能
} & M

export type V5Creep<M extends SerializableObject> = Omit<Creep, "memory"> & {
  memory: V5CreepMemory<M>
}

export type AnyV5Creep = V5Creep<SerializableObject>

export const isV5Creep = (creep: Omit<Creep, "memory">): creep is AnyV5Creep => {
  return (creep as Partial<AnyV5Creep>).memory?.v === "o5"
}
