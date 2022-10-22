import { ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "v5_problem/problem_solver"
import type { RoomName } from "shared/utility/room_name_types"
import { Task, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

export interface ActivateSafemodeProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName
}

export class ActivateSafemodeProblemSolver extends ProblemSolver {
  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
  ) {
    super(startTime, children, problemIdentifier)
  }

  public encode(): ActivateSafemodeProblemSolverState {
    return {
      t: "ActivateSafemodeProblemSolver",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      i: this.problemIdentifier,
      r: this.roomName,
    }
  }

  public static decode(state: ActivateSafemodeProblemSolverState, children: Task[]): ActivateSafemodeProblemSolver {
    return new ActivateSafemodeProblemSolver(state.s, children, state.i, state.r)
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName): ActivateSafemodeProblemSolver {
    return new ActivateSafemodeProblemSolver(Game.time, [], problemIdentifier, roomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const controller = objects.controller

    if (Memory.gameInfo.losingRoomNames?.includes(controller.room.name) === true) {
      return TaskStatus.Finished
    }

    const result = controller.activateSafeMode()

    switch (result) {
    case OK:
      return TaskStatus.Finished

    case ERR_BUSY:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_TIRED:
      return TaskStatus.Failed

    case ERR_NOT_OWNER:
    default:
      PrimitiveLogger.fatal(`[Program bug] controller.activateSafeMode() returns ${result} at ${roomLink(this.roomName)}`)
      return TaskStatus.Failed
    }
  }
}
