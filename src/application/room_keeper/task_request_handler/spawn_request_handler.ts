import type { TaskIdentifier } from "application/task_identifier"
import { SpawnTaskRequestType } from "application/task_request"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { V5CreepMemory } from "prototype/creep"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { bodyDescription } from "utility/creep_body"
import { roomLink } from "utility/log"
import { ShortVersion } from "utility/system_info"
import { generateUniqueId } from "utility/unique_id"

interface SpawnRequestLog {
  taskIdentifier: TaskIdentifier
  bodyDescription: string
}

export class SpawnRequestHandler {
  public execute(spawnRequests: SpawnTaskRequestType[], roomResource: OwnedRoomResource): SpawnRequestLog[] {
    const logRequests: SpawnRequestLog[] = []

    const idleSpwans = roomResource.activeStructures.spawns.filter(spawn => spawn.spawning == null)
    if (idleSpwans.length <= 0) {
      return logRequests
    }

    const roomName = roomResource.room.name
    spawnRequests.sort((lhs, rhs) => lhs.priority - rhs.priority)
    idleSpwans.forEach(spawn => {
      const request = spawnRequests.shift()
      if (request == null) {
        return
      }

      const body = request.body
      const creepName = generateUniqueId(request.codename)
      const memory: V5CreepMemory = {
        v: ShortVersion.v5,
        p: roomName,
        r: request.roles,
        t: null,
        i: request.taskIdentifier,
      }

      const result = spawn.spawnCreep(body, creepName, {memory})
      switch (result) {
      case OK:
        logRequests.push({
          taskIdentifier: request.taskIdentifier,
          bodyDescription: bodyDescription(body),
        })
        break
      case ERR_BUSY:
      case ERR_NOT_ENOUGH_ENERGY:
      case ERR_RCL_NOT_ENOUGH:
        break
      case ERR_NOT_OWNER:
      case ERR_NAME_EXISTS:
      default:
        PrimitiveLogger.fatal(`${spawn.name} in ${roomLink(roomName)} faild to spawn ${result}, task: ${request.taskIdentifier}, creep name: ${creepName}, body(length: ${body.length}): ${body}`)
      }
    })

    return logRequests
  }
}
