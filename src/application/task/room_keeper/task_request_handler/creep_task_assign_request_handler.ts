import { CreepTaskAssignTaskRequest } from "application/task_request"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName, isV6Creep } from "prototype/creep"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { roomLink } from "utility/log"

// TODO: creepのtask実行
export class CreepTaskAssignRequestHandler {
  public execute(creepTaskAssignRequests: Map<CreepName, CreepTaskAssignTaskRequest>, roomResource: OwnedRoomResource): void {
    creepTaskAssignRequests.forEach((request, creepName) => {
      const creep = Game.creeps[creepName]
      if (creep == null) {
        PrimitiveLogger.programError(`No creep to assign task ${creepName} at ${roomLink(roomResource.room.name)}`)
        return
      }
      if (!isV6Creep(creep)) {
        PrimitiveLogger.programError(`Creep ${creepName} is not v6 creep ${roomLink(roomResource.room.name)}`)
        return
      }
      creep.task = request.task
      if (request.task.shortDescription != null) {
        creep.say(request.task.shortDescription)
      }
    })
  }
}
