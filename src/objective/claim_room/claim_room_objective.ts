import { CreepInsufficiencyProblem } from "objective/creep_existence/creep_insufficiency_problem"
import { Objective } from "objective/objective"
import { Problem } from "objective/problem"
import { TaskRunner } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequest, CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { RoomNotClaimedProblem } from "./room_not_claimed_problem"

export class ClaimRoomObjective implements Objective {
  public readonly children: Objective[]

  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
  ) {
    this.children = [
    ]
  }

  public taskRunners(): TaskRunner[] {
    const taskRunners: TaskRunner[] = this.children.flatMap(child => child.taskRunners())
    return taskRunners
  }

  public currentProblems(): Problem[] {
    const problems = this.children.flatMap(child => child.currentProblems())

    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom == null || targetRoom.controller == null || targetRoom.controller.my !== true) {
      const roomNotClaimedProblem = new RoomNotClaimedProblem(this.objects, this.targetRoomName, this.waypoints)
      problems.push(roomNotClaimedProblem)

      const identifier = roomNotClaimedProblem.identifier
      const roomName = this.objects.controller.room.name
      const necessaryRoles = [CreepRole.Claimer, CreepRole.Mover]
      const claimerCount = World.resourcePools.countCreeps(roomName, identifier, creep => {
        return hasNecessaryRoles(creep, necessaryRoles)
      })
      if (claimerCount <= 0) {
        const request: CreepSpawnRequest = {
          priority: CreepSpawnRequestPriority.Low,
          numberOfCreeps: 1,
          codename: generateCodename(this.constructor.name, this.targetRoomName.split("").reduce((r, c) => r + c.charCodeAt(0), 0)),
          roles: necessaryRoles,
          body: null,
          initialTask: null,
          taskRunnerIdentifier: identifier,
          parentRoomName: null,
        }

        problems.push(new CreepInsufficiencyProblem(roomName, request))
      }
    }

    return problems
  }
}
