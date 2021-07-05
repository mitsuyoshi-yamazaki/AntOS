import { CreepInsufficiencyProblem } from "objective/creep_existence/creep_insufficiency_problem"
import { LaunchableObjective, Objective } from "objective/objective"
import { Problem } from "objective/problem"
import { CreateConstructionSiteTaskRunner } from "objective/room_planning/create_construction_site_task_runner"
import { TaskRunner } from "objective/task_runner"
import { UpgradeControllerObjective } from "objective/upgrade_controller/upgrade_controller_objective"
import { CreepRole } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export class RoomKeeperObjective implements LaunchableObjective {
  public readonly type = "RoomKeeperObjective"
  public readonly children: Objective[]
  public readonly roomName: RoomName

  private needsMinimumWorkers = false

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.children = [
      new UpgradeControllerObjective(this.objects),
    ]

    this.roomName = this.objects.controller.room.name
    const numberOfCreeps = World.resourcePools.checkCreeps(this.roomName, () => true)  // TODO: もう少し厳密な条件にする
    this.needsMinimumWorkers = numberOfCreeps < 2
  }

  public taskRunners(): TaskRunner[] {
    const taskRunners: TaskRunner[] = [
      new CreateConstructionSiteTaskRunner(this.objects),
    ]
    taskRunners.push(...this.children.flatMap(child => child.taskRunners()))
    return taskRunners
  }

  public currentProblems(): Problem[] {
    let childProblems = this.children.flatMap(child => child.currentProblems())
    if (this.needsMinimumWorkers === true) {
      childProblems = childProblems.filter(problem => !(problem instanceof CreepInsufficiencyProblem))
      childProblems.push(new CreepInsufficiencyProblem(this.roomName, [CreepRole.Worker, CreepRole.Mover, CreepRole.EnergyStore], [CARRY, WORK, MOVE]))
    }
    return childProblems
  }
}
