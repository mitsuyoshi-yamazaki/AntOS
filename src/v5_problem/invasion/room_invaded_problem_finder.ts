import { ProblemFinder, ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver } from "v5_problem/problem_solver"
import { RoomName } from "utility/room_name"
import { TowerInterceptionProblemSolver } from "v5_task/defence/tower_interception_problem_solver"
import { OwnedRoomObjects } from "world_info/room_info"
import { ActivateSafemodeProblemSolver } from "v5_task/defence/activate_safemode_task"
import { World } from "world_info/world_info"

// TODO: プレイヤーによる攻撃をroom_attacked_problem_finderに分離する
export class RoomInvadedProblemFinder implements ProblemFinder {
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
    const roomObjects = World.rooms.getOwnedRoomObjects(this.roomName)
    if (roomObjects != null && roomObjects.controller.safeMode == null) {
      problemSolvers.push(ActivateSafemodeProblemSolver.create(this.identifier, this.roomName))
    }
    // TODO: 低レベルではcreepを退避させる

    return problemSolvers
  }
}
