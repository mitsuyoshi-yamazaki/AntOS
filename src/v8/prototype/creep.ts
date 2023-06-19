import { ShortVersion, ShortVersionV9 } from "shared/utility/system_info"

export type V9Creep = Omit<Creep, "memory"> & { memory: V9CreepMemory }

export const isV9Creep = (creep: Creep | V9Creep): creep is V9Creep => {
  if (creep.memory.v === ShortVersion.v9) {
    return true
  }
  return false
}

export type V9CreepMemory = {
  readonly v: ShortVersionV9
}

