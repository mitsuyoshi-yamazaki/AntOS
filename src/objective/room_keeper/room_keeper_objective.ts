import { Objective, ObjectiveStatus } from "objective/objective"
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
    this.children.forEach(childObjective => {
      taskRunners.push(...childObjective.taskRunners())
    })
    return taskRunners
  }

  public currentStatus(): ObjectiveStatus {
    const problems: Problem[] = this.children.reduce((result, current) => {
      const status = current.currentStatus()
      switch (status.objectiveStatus) {
      case "achieved":
        break
      case "not achieved":
        result.push(...status.problems)
        break
      }
      return result
    }, [] as Problem[])

    if (problems.length > 0) {
      return ObjectiveStatus.NotAchieved(problems)
    }
    return ObjectiveStatus.Achieved()
  }
}
