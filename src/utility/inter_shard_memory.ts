/**
 * - 情報を受け取らせるrequestと情報を発信し続けるinformationの二種類
 */

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName } from "prototype/creep"
import { RoomResources } from "room_resource/room_resources"
import { Environment } from "./environment"
import { SystemInfo } from "./system_info"
import { Timestamp } from "./timestamp"
import { ValuedArrayMap, ValuedMapArrayMap } from "./valued_collection"

type ShardName = string

type ShardMemoryRequestCreepMemory = {
  case: "creep"
  creeps: {
    readonly name: CreepName,
    readonly memory: CreepMemory,
  }[]
}
export type ShardMemoryRequest = ShardMemoryRequestCreepMemory

type ShardMemoryRequestCases = ShardMemoryRequest["case"]

type ShardMemoryPublishing = {
  claimedRoomCount: number
  readonly readRequests: {[shardName: string]: Timestamp[]}
}

type ShardMemory = {
  /// Migrationチェック用アプリケーションバージョン
  readonly v: string
  tick: Timestamp
  readonly publishing: ShardMemoryPublishing
  readonly requests: {[shardName: string]: ShardMemoryRequest[]}
}

export interface InterShardMemoryObserver {
  didReceiveRemoteShardRequest(request: ShardMemoryRequest, shard: ShardName): void
}

let memoryModified = false
const activeRemoteShardNames = Memory.gameInfo.activeShards ?? []

const remoteShardMemories = new Map<ShardName, ShardMemory | false>()
const remoteOservers = new ValuedMapArrayMap<ShardName, ShardMemoryRequestCases, InterShardMemoryObserver>()
const requests = new ValuedArrayMap<ShardName, ShardMemoryRequest>()

const loadLocalMemory = (): ShardMemory => {
  const emptyMemory = (): ShardMemory => {
    return {
      v: SystemInfo.application.version,
      tick: Game.time,
      publishing: {
        claimedRoomCount: RoomResources.getOwnedRoomResources().length,
        readRequests: {},
      },
      requests: {},
    }
  }

  const stringfiedMemory = InterShardMemory.getLocal()
  if (stringfiedMemory == null) {
    return emptyMemory()
  }

  const parsed = JSON.parse(stringfiedMemory) as ShardMemory | undefined
  if (parsed == null || parsed.v !== SystemInfo.application.version) {
    const empty = emptyMemory()
    memoryModified = true
    return empty
  }
  return parsed
}

export const InterShardMemoryWatcher = (() => {
  if (Environment.hasMultipleShards !== true && activeRemoteShardNames.length > 0) {
    return null
  }

  return {
    expandedMemory: loadLocalMemory(),

    startOfTick(): void {
      remoteShardMemories.clear()
      requests.clear()

      const claimedRoomCount = RoomResources.getOwnedRoomResources().length
      if (this.expandedMemory.publishing.claimedRoomCount !== claimedRoomCount) {
        this.expandedMemory.publishing.claimedRoomCount = claimedRoomCount
        memoryModified = true
      }
    },

    run(): void {
      if (remoteOservers.size <= 0) {
        return
      }

      Array.from(remoteOservers.entries()).forEach(([shardName, observersForRequest]) => {
        const shardMemory = getRemoteShardMemory(shardName)
        if (shardMemory === false) {
          return
        }

        const requests = shardMemory.requests[Environment.shard]
        if (requests == null) {
          return
        }

        requests.forEach(request => {
          notifyRequest(shardName, request)
        })
      })

      if (this.expandedMemory.tick !== Game.time) {
        this.expandedMemory.tick = Game.time
        memoryModified = true
      }
    },

    endOfTick(): void {
      if (memoryModified === true) {
        InterShardMemory.setLocal(JSON.stringify(this.expandedMemory))
        memoryModified = false
      }
    },

    registerObserver(observer: InterShardMemoryObserver, shard: ShardName, requestCase: ShardMemoryRequestCases): void {
      remoteOservers.getValueFor(shard).getValueFor(requestCase).push(observer)
    },

    request(request: ShardMemoryRequest, shard: ShardName): void {
      requests.getValueFor(shard).push(request)
    },
  }
})()

const notifyRequest = (shardName: ShardName, request: ShardMemoryRequest): void => {
  const creepObservers = remoteOservers.get(shardName)?.get(request.case) ?? []
  if (creepObservers.length <= 0) {
    return
  }

  creepObservers.forEach(observer => {
    observer.didReceiveRemoteShardRequest(request, shardName)
  })
}

const getRemoteShardMemory = (shardName: ShardName): ShardMemory | false => {
  const stored = remoteShardMemories.get(shardName)
  if (stored != null) {
    return stored
  }

  if (activeRemoteShardNames.includes(shardName) !== true) {
    PrimitiveLogger.programError(`InterShardMemoryWatcher no active shard with name ${shardName}`)
    remoteShardMemories.set(shardName, false)
    return false
  }

  const stringfiedMemory = InterShardMemory.getRemote(shardName)
  if (stringfiedMemory == null) {
    remoteShardMemories.set(shardName, false)
    return false
  }

  try {
    const parsed = JSON.parse(stringfiedMemory) as ShardMemory | null
    if (parsed != null && parsed.v !== SystemInfo.application.version) {
      remoteShardMemories.set(shardName, parsed)  // 型は整合性のあるものと想定
      return parsed
    }

  } catch (error) {
    PrimitiveLogger.programError(`InterShardMemoryWatcher failed to parse ${shardName} shard memory: ${error}\n${stringfiedMemory}`)
  }

  remoteShardMemories.set(shardName, false)
  return false
}
