import { V5CreepMemory } from "prototype/creep"
import { RoomName } from "utility/room_name"
import { generateUniqueId } from "utility/unique_id"
import { createBodyFrom, CreepSpawnRequest, mergeRequests, sortRequests } from "./creep_specs"
import { ResourcePoolType } from "./resource_pool"

export class SpawnPool implements ResourcePoolType<StructureSpawn> {
  private readonly spawns: StructureSpawn[] = []

  public constructor(
    public readonly parentRoomName: RoomName,
  ) { }

  public addResource(spawn: StructureSpawn): void {
    this.spawns.push(spawn)
  }

  public spawnCreeps(rawRequests: CreepSpawnRequest[]): void {
    const idleSpawns = this.spawns.filter(spawn => spawn.spawning == null)
    if (idleSpawns.length <= 0) {
      return
    }
    const requests = sortRequests(mergeRequests(rawRequests))

    idleSpawns.forEach(spawn => {
      const request = requests.shift()
      if (request == null) {
        return
      }
      const creepName = generateUniqueId(request.codename)
      const body = request.body ?? createBodyFrom(request.roles, spawn.room.energyCapacityAvailable)
      const memory: V5CreepMemory = {
        v: "v5",
        p: request.parentRoomName ?? this.parentRoomName,
        r: request.roles,
        t: request.initialTask?.encode() ?? null,
        i: request.taskIdentifier,
      }
      const result = spawn.spawnCreep(body, creepName, { memory: memory })
      if (result === OK) {
        const creep = Game.creeps[creepName]  // spawnCreep()が成功した瞬間に生成される
        creep.task = request.initialTask
      }
    })
  }
}
