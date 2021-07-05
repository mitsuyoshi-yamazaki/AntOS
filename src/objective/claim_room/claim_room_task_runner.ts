import { TaskRunner } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { MoveClaimControllerTask } from "task/creep_task/combined_task/move_claim_controller_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export class ClaimRoomTaskRunner implements TaskRunner {
  public constructor(
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
  ) {}

  public run(objects: OwnedRoomObjects): void {
    const roomName = objects.controller.room.name
    const necessaryRoles: CreepRole[] = [CreepRole.Claimer, CreepRole.Mover]

    World.resourcePools.assignTasks(
      roomName,
      CreepPoolAssignPriority.Low,
      () => {
        return MoveClaimControllerTask.create(this.targetRoomName, this.waypoints)
      },
      creep => hasNecessaryRoles(creep, necessaryRoles),
    )
  }
}
