import { CreepInsufficiencyProblem } from "objective/creep_existence/creep_insufficiency_problem"
import { Objective } from "objective/objective"
import { Problem } from "objective/problem"
import { TaskRunner } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { ClaimRoomTaskRunner } from "./claim_room_task_runner"

export class ClaimRoomObjective implements Objective {
  public readonly children: Objective[]

  private readonly claimRoomTaskRunner: ClaimRoomTaskRunner | null

  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
  ) {
    this.children = [
    ]

    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom == null || targetRoom.controller == null || targetRoom.controller.my !== true) {
      this.claimRoomTaskRunner = new ClaimRoomTaskRunner(this.targetRoomName, this.waypoints)
    } else {
      this.claimRoomTaskRunner = null
    }
  }

  public taskRunners(): TaskRunner[] {
    const taskRunners: TaskRunner[] = this.children.flatMap(child => child.taskRunners())
    if (this.claimRoomTaskRunner != null) {
      taskRunners.push(this.claimRoomTaskRunner)
    }
    return taskRunners
  }

  public currentProblems(): Problem[] {
    const problems = this.children.flatMap(child => child.currentProblems())

    if (this.claimRoomTaskRunner != null) {
      const identifier = this.claimRoomTaskRunner.taskRunnerIdentifier
      const roomName = this.objects.controller.room.name
      const necessaryRoles = [CreepRole.Claimer, CreepRole.Mover]
      const claimerCount = World.resourcePools.countCreeps(roomName, identifier, creep => {
        return hasNecessaryRoles(creep, necessaryRoles)
      })
      if (claimerCount <= 0) {
        problems.push(new CreepInsufficiencyProblem(roomName, necessaryRoles, null, identifier))
      }
    }

    return problems
  }
}
