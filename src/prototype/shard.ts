import { SingleCreepProviderCreepRequest } from "old_objective/creep_provider/single_creep_provider_objective"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName } from "./creep"
import { RoomName } from "./room"

export type ShardName = string

interface InterShardCreepRequest {
  /** object type identifier */
  i: "InterShardCreepRequest"

  /** from shard name */
  f: ShardName

  /** to shard name */
  t: ShardName

  /** room contains portal to from shard */
  p: RoomName

  /** creep request */
  c: SingleCreepProviderCreepRequest
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
function isInterShardCreepRequest(arg: any): arg is InterShardCreepRequest {
  return arg.i === "InterShardCreepRequest"
}

interface InterShardMemoryContent {
  /** creep requests to other shards */
  c: InterShardCreepRequest[]

  /** received creep request names */
  r: {[index: string]: CreepName[]} // index: shard name
}

const cachedRequests: InterShardCreepRequest[] = []

export const InterShardMemoryManager = {
  requestCreepToShard: function (shardName: ShardName, portalRoomName: RoomName, creepRequest: SingleCreepProviderCreepRequest): void {
    PrimitiveLogger.fatal("InterShardMemoryManager not implemented yet")  // TODO:

    const request: InterShardCreepRequest = {
      i: "InterShardCreepRequest",
      f: Game.shard.name,
      t: shardName,
      p: portalRoomName,
      c: creepRequest,
    }
    cachedRequests.push(request)
  },
  store: function (): void {
    if (cachedRequests.length <= 0) {
      return
    }

    const requests = ((): InterShardCreepRequest[] => {
      const rawLocalMemory = InterShardMemory.getLocal()
      if (rawLocalMemory == null) {
        return cachedRequests
      }
      if (rawLocalMemory.length <= 0) {
        return cachedRequests
      }
      const parsedMemory = JSON.parse(rawLocalMemory) as InterShardMemoryContent | null
      if (parsedMemory == null) {
        return cachedRequests
      }
      if (!(parsedMemory.c instanceof Array)) {
        return cachedRequests
      }
      return parsedMemory.c.filter(content => isInterShardCreepRequest(content)).concat(cachedRequests)
    })()

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const content: InterShardMemoryContent = {
      c: requests,
      r: {},  // TODO:
    }
    // InterShardMemory.setLocal(JSON.stringify(content)) // TODO:
  }
}
