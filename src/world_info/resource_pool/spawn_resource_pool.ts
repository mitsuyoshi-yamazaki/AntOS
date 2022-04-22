import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { V5CreepMemory } from "prototype/creep"
import { bodyCost } from "utility/creep_body"
import { roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { generateUniqueId, UniqueId } from "utility/unique_id"
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

  public show(text: string, color: string): void {
    const spawn = this.spawns[0]
    if (spawn == null) {
      return
    }
    spawn.room.visual.text(text, spawn.pos, {color})
  }

  public spawnCreeps(rawRequests: CreepSpawnRequest[]): void {
    const idleSpawns = this.spawns.filter(spawn => spawn.spawning == null)
    const spawn = idleSpawns[0]
    if (spawn == null) {
      return
    }
    // if (idleSpawns.length <= 0) {  // FixMe: Persistent Worldでひとつのリクエストを複数のSpawnで実行してしまう問題の対処療法
    //   return
    // }
    const requests = sortRequests(mergeRequests(rawRequests))

    // idleSpawns.forEach(spawn => {
    const requestCount = requests.length
    for (let i = 0; i < requestCount; i += 1) {
      const request = requests.shift()
      if (request == null) {
        return
      }
      if (request.roles == null) {
        PrimitiveLogger.programError(`SpawnPool.spawnCreeps() request.role is null ${request.roles}, task id: ${request.taskIdentifier}, ${roomLink(spawn.room.name)}`)
        continue
      }
      const creepName = request.name ?? UniqueId.generateCreepName(request.codename)
      const body = request.body ?? createBodyFrom(request.roles, spawn.room.energyCapacityAvailable)
      const cost = bodyCost(body)
      if (cost > spawn.room.energyCapacityAvailable) {
        PrimitiveLogger.programError(`Spawn request ${request.taskIdentifier}, ${request.roles} body is too large (${body.length}parts ${cost}Energy) in ${roomLink(this.parentRoomName)} capacity: ${spawn.room.energyCapacityAvailable}`)
        continue
      }
      const memory: V5CreepMemory = {
        v: "v5",
        p: request.parentRoomName ?? this.parentRoomName,
        r: request.roles,
        t: request.initialTask?.encode() ?? null,
        i: request.taskIdentifier,
        n: false,
      }
      const result = spawn.spawnCreep(body, creepName, { memory: memory })
      switch (result) {
      case OK: {
        const creep = Game.creeps[creepName]  // spawnCreep()が成功した瞬間に生成される
        if (creep != null) {
          creep.v5task = request.initialTask
        }
        return  // ここはreturn
      }
      case ERR_NOT_ENOUGH_ENERGY:
        return  // ここはreturn
      default:
        PrimitiveLogger.programError(`${spawn.name} in ${roomLink(this.parentRoomName)} faild to spawn ${result}, task: ${request.taskIdentifier}, creep name: ${creepName}, body(length: ${body.length}): ${body}`)
        break
      }
    }
    // })
  }
}
