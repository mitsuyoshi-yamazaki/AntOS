import { AnyTaskProblem } from "application/any_problem"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

export type RoomKeeperTaskProblemTypes = UnexpectedProblem

export class RoomKeeperProblemSolver {

  /**
   * @returns Unresolved problems
   */
  public execute(problems: AnyTaskProblem[], roomResource: OwnedRoomResource): RoomKeeperTaskProblemTypes[] {
    const result: UnexpectedProblem[] = problems.map(problem => { // TODO:
      if (problem instanceof UnexpectedProblem) {
        return problem
      }
      return new UnexpectedProblem(problem)
    })
    return result
  }
}
