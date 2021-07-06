import { ProblemIdentifier } from "objective/problem"
import { ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { TaskRunnerIdentifier } from "objective/task_runner"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { MoveClaimControllerTask } from "object_task/creep_task/combined_task/move_claim_controller_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export interface RoomNotClaimedProblemSolverState extends ProblemSolverState {
  /** target room name */
  r: RoomName

  /** waypoints */
  w: RoomName[]
}

export class RoomNotClaimedProblemSolver implements ProblemSolver {
  public readonly taskRunnerIdentifier: TaskRunnerIdentifier

  private constructor(
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
  ) {
    this.taskRunnerIdentifier = `${this.constructor.name}_${this.targetRoomName}`
  }

  public encode(): RoomNotClaimedProblemSolverState {
    return {
      t: "RoomNotClaimedProblemSolver",
      p: this.problemIdentifier,
      r: this.targetRoomName,
      w: this.waypoints,
    }
  }

  public static decode(state: RoomNotClaimedProblemSolverState): RoomNotClaimedProblemSolver {
    return new RoomNotClaimedProblemSolver(state.p, state.r, state.w)
  }

  public static create(problemIdentifier: ProblemIdentifier, targetRoomName: RoomName, waypoints: RoomName[]): RoomNotClaimedProblemSolver {
    return new RoomNotClaimedProblemSolver(problemIdentifier, targetRoomName, waypoints)
  }

  public run(objects: OwnedRoomObjects): void {
    const roomName = objects.controller.room.name
    const necessaryRoles: CreepRole[] = [CreepRole.Claimer, CreepRole.Mover]

    World.resourcePools.assignTasks(
      roomName,
      this.taskRunnerIdentifier,
      CreepPoolAssignPriority.Low,
      () => {
        return MoveClaimControllerTask.create(this.targetRoomName, this.waypoints)
      },
      creep => hasNecessaryRoles(creep, necessaryRoles),
    )
  }
}
