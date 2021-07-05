import { ProblemIdentifier } from "objective/problem"
import { ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { TaskRunnerIdentifier } from "objective/task_runner"
import { RoomName } from "prototype/room"
import { TowerPoolTaskPriority, TowerTask } from "world_info/resource_pool/tower_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export interface TowerInterceptionProblemSolverState extends ProblemSolverState {
  /** room name */
  r: RoomName,

  /** target id */
  i: Id<AnyCreep> | null
}

export class TowerInterceptionProblemSolver implements ProblemSolver {
  public get taskRunnerIdentifier(): TaskRunnerIdentifier {
    return this.problemIdentifier
  }

  private constructor(
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly roomName: RoomName,
    private targetId: Id<AnyCreep> | null,
  ) {
  }

  public encode(): TowerInterceptionProblemSolverState {
    return {
      t: "TowerInterceptionProblemSolver",
      p: this.problemIdentifier,
      r: this.roomName,
      i: this.targetId,
    }
  }

  public static decode(state: TowerInterceptionProblemSolverState): TowerInterceptionProblemSolver {
    return new TowerInterceptionProblemSolver(state.p, state.r, state.i)
  }

  public static create(problemIdentifier: ProblemIdentifier, roomName: RoomName): TowerInterceptionProblemSolver {
    return new TowerInterceptionProblemSolver(problemIdentifier, roomName, null)
  }

  public run(objects: OwnedRoomObjects): void {
    const target = objects.hostiles.creeps[0] ?? objects.hostiles.powerCreeps[0]
    if (target == null) {
      return
    }
    World.resourcePools.addTowerTask(this.roomName, TowerTask.Attack(target, TowerPoolTaskPriority.Urgent))
  }
}
