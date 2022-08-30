import { ProblemFinder, ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver } from "v5_problem/problem_solver"
import { RoomName } from "shared/utility/room_name"
import { RoomInvisibleProblemSolver } from "v5_task/scout/room_invisible_problem_solver"
import { OwnedRoomObjects } from "world_info/room_info"

export class RemoteRoomAttackedProblemFinder implements ProblemFinder {
  public readonly roomName: RoomName
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly targetRoomName: RoomName,
  ) {
    this.roomName = this.objects.controller.room.name
    this.identifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
  }

  public problemExists(): boolean {
    return false  // TODO: OwnedRoom以外のオブジェクトも集計する
  }

  public getProblemSolvers(): ProblemSolver[] {
    const problemSolvers: ProblemSolver[] = [
      RoomInvisibleProblemSolver.create(this.identifier, this.targetRoomName),
    ]

    return problemSolvers
  }
}
