export type CreepName = string

export type SpawnedCreep = Creep & { ticksToLive: number }

export const isSpawnedCreep = <C extends Omit<Creep, "memory">>(creep: C): creep is C & { ticksToLive: number } => creep.ticksToLive != null
