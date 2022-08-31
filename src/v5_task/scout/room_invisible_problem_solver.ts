import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { ProblemIdentifier } from "v5_problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "v5_problem/problem_solver"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import type { RoomName } from "shared/utility/room_name_types"
import { Task, TaskStatus } from "v5_task/task"
import { generateCodename } from "utility/unique_id"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { CreepSpawnRequest, CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export interface RoomInvisibleProblemSolverState extends ProblemSolverState {
  /** target room name */
  tr: RoomName

  /** codename */
  n: string

  /** waypoints */
  w: RoomName[]
}

/**
 * - ScoutRoomTaskとは異なり、Scout Creepはその部屋に留まり一生を終える
 */
export class RoomInvisibleProblemSolver extends ProblemSolver {
  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly targetRoomName: RoomName,
    public codename: string,
    public waypoints: RoomName[],
  ) {
    super(startTime, children, problemIdentifier)
  }

  public encode(): RoomInvisibleProblemSolverState {
    return {
      t: "RoomInvisibleProblemSolver",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      i: this.problemIdentifier,
      tr: this.targetRoomName,
      n: this.codename,
      w: this.waypoints,
    }
  }

  public static decode(state: RoomInvisibleProblemSolverState, children: Task[]): RoomInvisibleProblemSolver {
    return new RoomInvisibleProblemSolver(state.s, children, state.i, state.tr, state.n, state.w)
  }

  public static create(problemIdentifier: ProblemIdentifier, targetRoomName: RoomName): RoomInvisibleProblemSolver {
    const time = Game.time
    const codename = generateCodename("RoomInvisibleProblemSolver", time)
    return new RoomInvisibleProblemSolver(time, [], problemIdentifier, targetRoomName, codename, [])
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const roomName = objects.controller.room.name
    const necessaryRoles: CreepRole[] = [CreepRole.Scout]
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)
    const creepCount = World.resourcePools.countCreeps(roomName, this.taskIdentifier, creepPoolFilter)

    if (creepCount > 0) {
      if (World.rooms.get(this.targetRoomName) != null) {
        return TaskStatus.Finished
      }
      return TaskStatus.InProgress
    }

    const options: SequentialTaskOptions = {
      ignoreFailure: true,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, this.waypoints),
      MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 10), // TODO: Controller付近にでも行かせる
      EndlessTask.create(),
    ]
    const scoutTask = SequentialTask.create(tasks, options)

    const request: CreepSpawnRequest = {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: necessaryRoles,
      body: null,
      initialTask: scoutTask,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    }

    World.resourcePools.addSpawnCreepRequest(roomName, request)
    return TaskStatus.InProgress
  }
}
