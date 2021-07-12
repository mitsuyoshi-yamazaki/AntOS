import { ProblemFinder, ProblemIdentifier } from "problem/problem_finder"
import { ProblemSolver } from "problem/problem_solver"
import { RoomName } from "utility/room_name"
import { TowerRepairProblemSolver } from "v5_task/repair/tower_repair_problem_solver"
import { OwnedRoomObjects } from "world_info/room_info"

export class OwnedRoomDecayedStructureProblemFinder implements ProblemFinder {
  public readonly roomName: RoomName
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.roomName = this.objects.controller.room.name
    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public problemExists(): boolean {
    return this.objects.decayedStructures.length > 0
  }

  public getProblemSolvers(): ProblemSolver[] {
    const problemSolvers: ProblemSolver[] = []

    const towerExists = this.objects.activeStructures.towers.length > 0
    if (towerExists) {
      problemSolvers.push(TowerRepairProblemSolver.create(this.identifier, this.roomName))
    }

    return problemSolvers
  }
}
