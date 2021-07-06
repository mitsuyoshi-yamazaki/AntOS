import { Problem, ProblemIdentifier } from "objective/problem"
import { ProblemSolver } from "objective/problem_solver"
import { RoomName } from "prototype/room"
import { OwnedRoomObjects } from "world_info/room_info"
import { TowerInterceptionProblemSolver } from "./tower_interception_problem_solver"

export class OwnedRoomInvadedProblem implements Problem {
  public readonly identifier: ProblemIdentifier
  public readonly roomName: RoomName

  public constructor(
    public readonly objects: OwnedRoomObjects,
  ) {
    this.roomName = this.objects.controller.room.name
    this.identifier = `${this.constructor.name}_${this.roomName}`
  }

  public getProblemSolvers(): ProblemSolver[] {
    return [
      TowerInterceptionProblemSolver.create(this.identifier, this.roomName)
    ]
  }
}
