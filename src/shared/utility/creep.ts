export type CreepName = string

export type SpawnedCreep = Creep & { ticksToLive: number }

export const isSpawnedCreep = (creep: Creep): creep is SpawnedCreep => {
  if (creep.ticksToLive == null) {
    return false
  }
  return true
}
