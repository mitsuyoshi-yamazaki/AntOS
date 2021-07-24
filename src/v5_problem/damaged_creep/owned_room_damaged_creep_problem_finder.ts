import { ProblemFinder, ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver } from "v5_problem/problem_solver"
import { RoomName } from "utility/room_name"
import { OwnedRoomObjects } from "world_info/room_info"
import { TowerHealProblemSolver } from "v5_task/heal/tower_heal_problem_solver"

export class OwnedRoomDamagedCreepProblemFinder implements ProblemFinder {
  public readonly roomName: RoomName
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.roomName = this.objects.controller.room.name
    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public problemExists(): boolean {
    return this.objects.damagedCreeps.length > 0
  }

  public getProblemSolvers(): ProblemSolver[] {
    const problemSolvers: ProblemSolver[] = []

    const towerExists = this.objects.activeStructures.towers.length > 0
    if (towerExists) {
      problemSolvers.push(TowerHealProblemSolver.create(this.identifier, this.roomName))
    }

    return problemSolvers
  }
}
