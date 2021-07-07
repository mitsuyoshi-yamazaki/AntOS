import { ProblemFinder, ProblemIdentifier } from "problem/problem_finder"
import { ProblemSolver } from "problem/problem_solver"
import { RoomName } from "prototype/room"
import { TowerInterceptionProblemSolver } from "task/defence/tower_interception_problem_solver"
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
    return this.objects.hostiles.creeps.length > 0 || this.objects.hostiles.powerCreeps.length > 0
  }

  public getProblemSolvers(): ProblemSolver[] {
    const problemSolvers: ProblemSolver[] = []

    const towerExists = this.objects.activeStructures.towers.length > 0
    if (towerExists) {
      problemSolvers.push(TowerInterceptionProblemSolver.create(this.identifier, this.roomName))
    }
    // TODO: ActivateSafemodeTask入れる
    // TODO: 低レベルではcreepを退避させる

    return problemSolvers
  }
}
