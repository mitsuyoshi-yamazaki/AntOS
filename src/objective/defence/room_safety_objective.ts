import { Objective } from "objective/objective"
import { Problem } from "objective/problem"
import { TaskRunner } from "objective/task_runner"
import { OwnedRoomObjects } from "world_info/room_info"
import { OwnedRoomInvadedProblem } from "./owned_room_invaded_problem"

export class RoomSafetyObjective implements Objective {
  public readonly children: Objective[]

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.children = [
      // TODO: 隣接する部屋の監視
    ]
  }

  public taskRunners(): TaskRunner[] {
    return this.children.flatMap(child => child.taskRunners())
  }

  public currentProblems(): Problem[] {
    const problems: Problem[] = this.children.flatMap(child => child.currentProblems())
    if (this.objects.hostiles.creeps.length > 0 || this.objects.hostiles.powerCreeps.length > 0) {
      problems.push(new OwnedRoomInvadedProblem(this.objects))
    }
    return problems
  }
}
