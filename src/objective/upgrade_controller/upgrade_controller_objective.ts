import { OwnedRoomCreepExistsObjective } from "objective/creep_existence/owned_room_creep_exists_objective"
import { OwnedRoomEnergyAvailableObjective } from "objective/energy_stored/owned_room_energy_available_objective"
import { Objective, ObjectiveStatus } from "objective/objective"
import { Problem } from "objective/problem"
import { TaskRunner } from "objective/task_runner"
import { OwnedRoomWorkTaskRunner } from "objective/worker/owned_room_worker_task_runner"
import { CreepRole } from "prototype/creep_role"
import { OwnedRoomObjects } from "world_info/room_info"

export class UpgradeControllerObjective implements Objective {
  public readonly children: Objective[]

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.children = [
      new OwnedRoomEnergyAvailableObjective(this.objects),
      new OwnedRoomCreepExistsObjective(this.objects, [CreepRole.Worker, CreepRole.Mover], 8 * this.objects.sources.length),
    ]
  }

  public taskRunners(): TaskRunner[] {
    const taskRunners: TaskRunner[] = [
      new OwnedRoomWorkTaskRunner(this.objects),
    ]
    this.children.forEach(childObjective => {
      taskRunners.push(...childObjective.taskRunners())
    })
    return taskRunners
  }

  public currentStatus(): ObjectiveStatus {
    // TODO: この辺はObjective（or ParentObjective）に含めて共通化する
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
      return ObjectiveStatus.NotAchieved(problems) // 全て集計しないとマージできないため、この段階でproblemの重複チェックはしない
    }
    return ObjectiveStatus.Achieved()
  }
}
