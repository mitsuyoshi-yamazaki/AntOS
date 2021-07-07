import { SequentialTask, SequentialTaskOptions } from "object_task/creep_task/combined_task/sequential_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { EndlessTask } from "object_task/creep_task/meta_task/endless_task"
import { MoveToRoomTask } from "object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "object_task/creep_task/meta_task/move_to_task"
import { ProblemIdentifier } from "problem/problem_finder"
import { ProblemSolver, ProblemSolverState } from "problem/problem_solver"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { RoomName } from "prototype/room"
import { Task, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { generateCodename } from "utility/unique_id"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { CreepSpawnRequest, CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export interface RoomInvisibleProblemSolverState extends ProblemSolverState {
  /** target room name */
  tr: RoomName
}

/**
 * - ScoutRoomTaskとは異なり、Scout Creepはその部屋に留まり一生を終える
 */
export class RoomInvisibleProblemSolver extends ProblemSolver {
  public codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
    public readonly targetRoomName: RoomName,
  ) {
    super(startTime, children, problemIdentifier)

    this.codename = generateCodename(this.constructor.name, this.startTime)
  }

  public encode(): RoomInvisibleProblemSolverState {
    return {
      t: "RoomInvisibleProblemSolver",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      i: this.problemIdentifier,
      tr: this.targetRoomName,
    }
  }

  public static decode(state: RoomInvisibleProblemSolverState): RoomInvisibleProblemSolver {
    const children = decodeTasksFrom(state.c)
    return new RoomInvisibleProblemSolver(state.s, children, state.i, state.tr)
  }

  public static create(problemIdentifier: ProblemIdentifier, targetRoomName: RoomName): RoomInvisibleProblemSolver {
    return new RoomInvisibleProblemSolver(Game.time, [], problemIdentifier, targetRoomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const roomName = objects.controller.room.name
    const necessaryRoles: CreepRole[] = [CreepRole.Scout]
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)
    const creepCount = World.resourcePools.countCreeps(roomName, this.taskIdentifier, creepPoolFilter)

    if (creepCount > 0 && World.rooms.get(this.targetRoomName) != null) {
      return TaskStatus.Finished
    }

    const options: SequentialTaskOptions = {
      ignoreFailure: true,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, []),
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
