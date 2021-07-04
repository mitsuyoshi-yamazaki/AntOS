import { SpawnName } from "prototype/structure_spawn"
// Worldをimportしない

const allSpawns: StructureSpawn[] = []

export const Spawns = {
  list: function (): StructureSpawn[] {
    return allSpawns
  },

  get: function (spawnName: SpawnName): StructureSpawn | null {
    return Game.spawns[spawnName]
  },

  beforeTick: function (): StructureSpawn[] {
    allSpawns.splice(0, allSpawns.length)
    for (const spawnName in Memory.spawns) {
      const spawn = Game.spawns[spawnName]
      if (spawn == null) {
        delete Memory.spawns[spawnName]
        continue
      }
      allSpawns.push(spawn)
    }

    return allSpawns.concat([])
  },

  afterTick: function (): void {

  },
}
