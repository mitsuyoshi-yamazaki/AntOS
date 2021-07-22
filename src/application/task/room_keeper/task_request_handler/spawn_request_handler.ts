import { TaskLogRequest } from "application/task_logger"
import { SpawnTaskRequestType } from "application/task_request"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { V6CreepMemory } from "prototype/creep"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { bodyDescription } from "utility/creep_body"
import { roomLink } from "utility/log"
import type { RoomName } from "utility/room_name"
import { ShortVersion } from "utility/system_info"
import { generateUniqueId } from "utility/unique_id"

export class SpawnRequestHandler {
  public constructor(
    public readonly roomName: RoomName,
  ) {
  }

  public execute(spawnRequests: SpawnTaskRequestType[], roomResource: OwnedRoomResource): TaskLogRequest[] {
    const logRequests: TaskLogRequest[] = []

    const idleSpwans = roomResource.activeStructures.spawns.filter(spawn => spawn.spawning == null)
    if (idleSpwans.length <= 0) {
      return logRequests
    }

    spawnRequests.sort((lhs, rhs) => {
      return lhs.priority - rhs.priority
    })

    const currentRequests: SpawnTaskRequestType[] = []
    const futureRequests: SpawnTaskRequestType[] = []

    spawnRequests.forEach(request => {
      if (request.neededIn <= 0) {
        currentRequests.push(request)
      } else {
        futureRequests.push(request)
      }
    })

    idleSpwans.forEach(spawn => {
      // TODO: 複数Spawnの考慮
      const request = ((): SpawnTaskRequestType | null => {
        const currentRequest = currentRequests[0]

        futureRequests.sort((lhs, rhs) => {
          return lhs.neededIn - rhs.neededIn
        })
        const futureRequest = futureRequests[0]
        if (currentRequest == null) {
          if (futureRequest == null) {
            return null
          }
          return futureRequest
        }
        if (futureRequest == null) {
          return currentRequest
        }
        if (currentRequest.spawnTimeCost < futureRequest.neededIn) {
          return currentRequest
        }
        if (currentRequest.priority < futureRequest.priority) {
          return currentRequest
        } else {
          return futureRequest
        }
      })()
      if (request == null) {
        return
      }
      const log = this.spawnCreep(request, spawn)
      if (log != null) {
        logRequests.push(log)
      }
    })

    return logRequests
  }

  private spawnCreep(request: SpawnTaskRequestType, spawn: StructureSpawn): TaskLogRequest | null {
    const body = request.body
    const creepName = generateUniqueId(request.codename)
    const memory: V6CreepMemory = {
      v: ShortVersion.v6,
      p: this.roomName,
      r: request.roles,
      t: request.initialTask?.encode() ?? null,
      i: request.taskIdentifier,
      ci: request.creepIdentifier,
    }

    const result = spawn.spawnCreep(body, creepName, { memory })
    switch (result) {
    case OK:
      return {
        taskIdentifier: request.taskIdentifier,
        logEventType: "event",
        message: `Spawn ${bodyDescription(body)}`,
      }
    case ERR_BUSY:
    case ERR_NOT_ENOUGH_ENERGY:
    case ERR_RCL_NOT_ENOUGH:
      return null

    case ERR_NOT_OWNER:
    case ERR_NAME_EXISTS:
    default:
      PrimitiveLogger.fatal(`${spawn.name} in ${roomLink(this.roomName)} faild to spawn ${result}, task: ${request.taskIdentifier}, creep name: ${creepName}, body(length: ${body.length}): ${body}`)
      return {
        taskIdentifier: request.taskIdentifier,
        logEventType: "found problem",
        message: `Failed to spawn ${bodyDescription(body)} (${result})`
      }
    }
  }
}
