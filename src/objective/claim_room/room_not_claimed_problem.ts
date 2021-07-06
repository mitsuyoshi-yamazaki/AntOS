import { Problem, ProblemIdentifier } from "objective/problem"
import { ProblemSolver } from "objective/problem_solver"
import { RoomName } from "prototype/room"
import { OwnedRoomObjects } from "world_info/room_info"
import { RoomNotClaimedProblemSolver } from "./room_not_claimed_problem_solver"

export class RoomNotClaimedProblem implements Problem {
  public readonly identifier: ProblemIdentifier

  public constructor(
    public readonly objects: OwnedRoomObjects,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
  ) {
    this.identifier = `${this.constructor.name}_${this.targetRoomName}`
  }

  public getProblemSolvers(): ProblemSolver[] {
    return [
      RoomNotClaimedProblemSolver.create(this.identifier, this.targetRoomName, this.waypoints),
    ]
  }
}
