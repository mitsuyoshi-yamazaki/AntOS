export type SpawningSpawn = StructureSpawn & { spawning: Spawning }
export const isSpawningSpawn = (spawn: StructureSpawn): spawn is SpawningSpawn => {
  if (spawn.spawning == null) {
    return false
  }
  return true
}
