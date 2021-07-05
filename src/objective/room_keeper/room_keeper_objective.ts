import { Objective } from "objective/objective"
import { Problem } from "objective/problem"
import { CreateConstructionSiteTaskRunner } from "objective/room_planning/create_construction_site_task_runner"
import { TaskRunner } from "objective/task_runner"
import { UpgradeControllerObjective } from "objective/upgrade_controller/upgrade_controller_objective"
import { OwnedRoomObjects } from "world_info/room_info"

export class RoomKeeperObjective implements Objective {
  public readonly children: Objective[]

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.children = [
      new UpgradeControllerObjective(this.objects),
    ]
  }

  public taskRunners(): TaskRunner[] {
    const taskRunners: TaskRunner[] = [
      new CreateConstructionSiteTaskRunner(this.objects),
    ]
    taskRunners.push(...this.children.flatMap(child => child.taskRunners()))
    return taskRunners
  }

  public currentProblems(): Problem[] {
    return this.children.flatMap(child => child.currentProblems())
  }
}
