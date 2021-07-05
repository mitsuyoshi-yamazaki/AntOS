import { ClaimRoomObjective } from "objective/claim_room/claim_room_objective"
import { CreepInsufficiencyProblem } from "objective/creep_existence/creep_insufficiency_problem"
import { Objective } from "objective/objective"
import { Problem } from "objective/problem"
import { TaskRunner } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { MoveToRoomTask } from "task/creep_task/meta_task/move_to_room_task"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

const numberOfWorkers = 10

/**
 * - target roomのspawnが建設されたら終了
 * - それまでcreepを送り続ける
 */
export class BootstrapRoomObjective implements Objective {
  public readonly children: Objective[]
  public readonly roomName: RoomName

  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
  ) {
    this.roomName = this.objects.controller.room.name
    this.children = [
      new ClaimRoomObjective(this.objects, this.targetRoomName, this.waypoints)
    ]
  }

  public taskRunners(): TaskRunner[] {
    const taskRunners: TaskRunner[] = this.children.flatMap(child => child.taskRunners())
    return taskRunners
  }

  public currentProblems(): Problem[] {
    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (targetRoomObjects != null && targetRoomObjects.activeStructures.spawns.length > 0) {
      return []
    }

    const problems = this.children.flatMap(child => child.currentProblems())

    const necessaryRoles = [CreepRole.Worker, CreepRole.Mover]
    const newRoomWorkerCreepCount = World.resourcePools.countCreeps(this.targetRoomName, null, creep => {
      return hasNecessaryRoles(creep, necessaryRoles)
    })
    if (newRoomWorkerCreepCount < numberOfWorkers) {
      const initialTask = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      problems.push(new CreepInsufficiencyProblem(this.roomName, necessaryRoles, null, initialTask, null, this.targetRoomName))
    }

    return problems
  }
}
