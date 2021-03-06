import { SpawnName } from "prototype/structure_spawn"
// Worldをimportしない

const allSpawns: StructureSpawn[] = []

export interface SpawnsInterface {
  // ---- Lifecycle ---- //
  beforeTick(): StructureSpawn[]
  afterTick(): void

  // ---- Function ---- //
  list(): StructureSpawn[]
  get(spawnName: SpawnName): StructureSpawn | null
}

export const Spawns: SpawnsInterface = {
  // ---- Lifecycle ---- //
  beforeTick: function (): StructureSpawn[] {
    allSpawns.splice(0, allSpawns.length)
    for (const spawnName in Game.spawns) {  // SpawnMemoryがundefideの場合に計上されないため
      const spawn = Game.spawns[spawnName]
      // if (spawn == null) {
      //   delete Memory.spawns[spawnName]
      //   continue
      // }
      allSpawns.push(spawn)
    }

    return allSpawns.concat([])
  },

  afterTick: function (): void {

  },

  // ---- Function ---- //
  list: function (): StructureSpawn[] {
    return allSpawns
  },

  get: function (spawnName: SpawnName): StructureSpawn | null {
    return Game.spawns[spawnName]
  },
}
